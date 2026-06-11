/**
 * @file game-engine.service.ts
 * @owner server-squad
 * @description Drives a started room through its rounds. Owns the in-memory
 * per-room loop and the server-authoritative phase timer. Delegates content
 * (showing the question) to the RoundPresenter seam and scoring to a later
 * slice. `run()` never throws — it is called fire-and-forget by LobbyService.
 */
import 'reflect-metadata'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Repository } from 'typeorm'
import { Round } from '../../entities/round.entity'
import { Room } from '../../entities/room.entity'
import { RoomStatusEnum, RoundStatusEnum } from '../../entities/enums'
import { RoomService } from '../room.service'
import { ClientService } from '../../client/client.service'
import { RoomBroadcaster } from '../lobby/room-broadcaster'
import { toRoomState } from '../room.helpers'
import * as EVENTS from '../../../shared/events/socket-events'
import { ROUNDS, TIMER } from '../../../shared/constants/game-config'
import type {
  GamePhase as WireGamePhase,
  LeaderboardEntry,
  RoundSummary,
  ScoreMap,
} from '../../../shared/types/index'
import {
  GamePhase,
  RoundPresenter,
  TimerOutcome,
  type PhaseTimerLike,
  type RunningGame,
} from './game.types'
import { PhaseTimer } from './phase-timer'
import { RoundBuilder } from './round-builder'
import { ROUND_PRESENTER } from './round-presenter'
import { GameEventBus } from './game-event-bus'
import { firstValueFrom } from 'rxjs'
import { filter, first, timeout } from 'rxjs/operators'

const PHASE_TO_WIRE: Record<GamePhase, WireGamePhase> = {
  [GamePhase.INTRO]: 'round-intro',
  [GamePhase.QUESTION]: 'playing',
  [GamePhase.REVEAL]: 'reveal',
  [GamePhase.LEADERBOARD]: 'leaderboard',
  [GamePhase.GAME_OVER]: 'game-over',
}

const FIRST_RANK = 1
const NO_RANK_CHANGE = 0
const NEW_PLAYER_POSITION = Number.MAX_SAFE_INTEGER

@Injectable()
export class GameEngineService {
  private readonly logger = new Logger(GameEngineService.name)
  private readonly games = new Map<string, RunningGame>()
  private readonly leaderboardOrderByRoom = new Map<string, string[]>()

  public constructor(
    private readonly broadcaster: RoomBroadcaster,
    private readonly rooms: RoomService,
    private readonly clients: ClientService,
    private readonly roundBuilder: RoundBuilder,
    @InjectRepository(Round) private readonly roundRepo: Repository<Round>,
    @Inject(ROUND_PRESENTER) private readonly presenter: RoundPresenter,
    private readonly bus: GameEventBus
  ) {}

  /** Overridable so tests can inject a controllable timer. */
  protected createTimer(): PhaseTimerLike {
    return new PhaseTimer()
  }

  /** Start driving a started room. Fire-and-forget; never throws. */
  public async run(roomId: string): Promise<void> {
    if (this.games.has(roomId)) {
      this.logger.warn(`run() ignored — game already running for room ${roomId}`)
      return
    }
    const game: RunningGame = { aborted: false, timer: this.createTimer() }
    this.games.set(roomId, game)

    try {
      const room = await this.rooms.findById(roomId)
      if (!room) {
        this.logger.error(`run(): room ${roomId} not found`)
        return
      }
      const rounds = await this.roundBuilder.buildRounds(room, ROUNDS.COUNT)

      for (const round of rounds) {
        if (game.aborted) {
          break
        }
        await this.runRound(room, round, game)
      }

      if (game.aborted) {
        await this.rooms.finishRoom(room, RoomStatusEnum.ABANDONED)
      } else {
        await this.rooms.finishRoom(room, RoomStatusEnum.FINISHED)
        this.broadcaster.emitToRoom(roomId, EVENTS.GAME_OVER, {
          finalScores: await this.buildScores(roomId),
        })
      }
    } catch (error) {
      this.logger.error(`Game loop failed for room ${roomId}: ${String(error)}`)
      await this.abandonQuietly(roomId)
    } finally {
      game.timer.cancel()
      this.bus.publish({ type: 'ROUND_WINDOW_ABORTED', roomId })
      this.games.delete(roomId)
      this.leaderboardOrderByRoom.delete(roomId)
    }
  }

  /** Trip the abort flag and cancel whatever phase is in flight. */
  public abort(roomId: string): void {
    const game = this.games.get(roomId)
    if (!game) {
      return
    }
    game.aborted = true
    game.timer.cancel()
  }

  private async runRound(
    room: { id: string; joinCode: string; status: RoomStatusEnum; currentRoundIndex: number },
    round: Round,
    game: RunningGame
  ): Promise<void> {
    await this.markRound(round, RoundStatusEnum.ACTIVE)
    await this.rooms.setCurrentRound(room as Room, round.roundIndex)
    this.broadcaster.emitToRoom(room.id, EVENTS.ROUND_START, { round: this.toRoundSummary(round) })

    if (await this.runPhase(room, game, GamePhase.INTRO, TIMER.ROUND_INTRO_SECONDS)) {
      return
    }

    await this.enterPhase(room, GamePhase.QUESTION)
    await this.present(room.id, round)

    let didEndEarly = false
    const earlySub = this.bus
      .on('ALL_PLAYERS_ANSWERED')
      .pipe(filter((e) => e.roomId === room.id && e.roundId === round.id))
      .subscribe(() => {
        didEndEarly = true
        game.timer.endEarly()
      })

    const didAbort = await this.timePhase(room.id, game, TIMER.QUESTION_SECONDS)
    earlySub.unsubscribe()
    if (didAbort) {
      this.bus.publish({ type: 'ROUND_WINDOW_ABORTED', roomId: room.id })
      return
    }
    this.broadcaster.emitToRoom(room.id, EVENTS.TIMER_EXPIRED)

    await this.closeAndAwaitScore(room.id, round.id, didEndEarly ? 'all-answered' : 'expired')

    if (await this.runPhase(room, game, GamePhase.REVEAL, TIMER.REVEAL_SECONDS)) {
      return
    }

    await this.markRound(round, RoundStatusEnum.FINISHED)
    this.broadcaster.emitToRoom(room.id, EVENTS.ROUND_END, {
      scores: await this.buildScores(room.id),
    })
    if (round.roundIndex === ROUNDS.COUNT) {
      await this.enterPhase(room, GamePhase.GAME_OVER)
      return
    }
    await this.enterPhase(room, GamePhase.LEADERBOARD)
    this.broadcaster.emitToRoom(room.id, EVENTS.LEADERBOARD_SHOW, {
      round: this.toRoundSummary(round),
      leaderboard: await this.buildLeaderboard(room.id),
    })
    if (await this.timePhase(room.id, game, TIMER.LEADERBOARD_SECONDS)) {
      return
    }
  }

  /** Enter a phase, then run its timer. Returns true if the game was aborted. */
  private async runPhase(
    room: { id: string; joinCode: string; status: RoomStatusEnum; currentRoundIndex: number },
    game: RunningGame,
    phase: GamePhase,
    seconds: number
  ): Promise<boolean> {
    await this.enterPhase(room, phase)
    return this.timePhase(room.id, game, seconds)
  }

  /** Run the active timer for one phase. Returns true if aborted. */
  private async timePhase(roomId: string, game: RunningGame, seconds: number): Promise<boolean> {
    const outcome = await game.timer.start(seconds, {
      onTick: (secondsRemaining) =>
        this.broadcaster.emitToRoom(roomId, EVENTS.TIMER_TICK, { secondsRemaining }),
    })
    return outcome === TimerOutcome.ABORTED
  }

  /** Close the answer window and wait for ScoringService to finish (with a
   * fallback timeout) so QUESTION_REVEAL precedes the reveal phase and ROUND_END
   * reflects this round's points. */
  private async closeAndAwaitScore(
    roomId: string,
    roundId: string,
    reason: 'expired' | 'all-answered'
  ): Promise<void> {
    const scored = firstValueFrom(
      this.bus.on('ROUND_SCORED').pipe(
        filter((e) => e.roomId === roomId && e.roundId === roundId),
        first(),
        timeout(TIMER.SCORED_AWAIT_TIMEOUT_MS)
      )
    )
    this.bus.publish({ type: 'ROUND_WINDOW_CLOSED', roomId, roundId, reason })
    try {
      await scored
    } catch {
      this.logger.warn(`ROUND_SCORED not received for round ${roundId}; proceeding`)
    }
  }

  /** Emit the phase change and a fresh room-state snapshot carrying the live phase. */
  private async enterPhase(
    room: { id: string; joinCode: string; status: RoomStatusEnum; currentRoundIndex: number },
    phase: GamePhase
  ): Promise<void> {
    const wire = PHASE_TO_WIRE[phase]
    this.broadcaster.emitToRoom(room.id, EVENTS.GAME_PHASE_CHANGE, { phase: wire })
    const roster = await this.clients.findByRoom(room.id)
    this.broadcaster.broadcastRoomState(room.id, toRoomState(room, roster, wire))
  }

  private async present(roomId: string, round: Round): Promise<void> {
    try {
      await this.presenter.present(roomId, round)
    } catch (error) {
      this.logger.error(`RoundPresenter failed for room ${roomId}: ${String(error)}`)
    }
  }

  private async markRound(round: Round, status: RoundStatusEnum): Promise<void> {
    round.status = status
    if (status === RoundStatusEnum.ACTIVE) {
      round.startedAt = new Date()
    }
    if (status === RoundStatusEnum.FINISHED) {
      round.finishedAt = new Date()
    }
    await this.roundRepo.save(round)
  }

  private toRoundSummary(round: Round): RoundSummary {
    return {
      index: round.roundIndex,
      total: ROUNDS.COUNT,
      type: 'quiz',
      timeLimitSeconds: round.timeLimitSeconds,
    }
  }

  private async buildScores(roomId: string): Promise<ScoreMap> {
    const roster = await this.clients.findByRoom(roomId)
    return Object.fromEntries(roster.map((c) => [c.id, c.totalScore]))
  }

  private async buildLeaderboard(roomId: string): Promise<LeaderboardEntry[]> {
    if (!roomId.trim()) {
      return []
    }

    const players = await this.clients.findByRoom(roomId)
    if (players.length === 0) {
      return []
    }

    const previousLeaderboardOrder = this.leaderboardOrderByRoom.get(roomId) ?? []

    const previousPositionByPlayerId = new Map(
      previousLeaderboardOrder.map((playerId, position) => [playerId, position])
    )

    const leaderboard = [...players].sort((firstPlayer, secondPlayer) => {
      const scoreOrder = secondPlayer.totalScore - firstPlayer.totalScore

      if (scoreOrder !== NO_RANK_CHANGE) {
        return scoreOrder
      }

      const firstPlayerPreviousPosition =
        previousPositionByPlayerId.get(firstPlayer.id) ?? NEW_PLAYER_POSITION

      const secondPlayerPreviousPosition =
        previousPositionByPlayerId.get(secondPlayer.id) ?? NEW_PLAYER_POSITION

      const previousPositionOrder = firstPlayerPreviousPosition - secondPlayerPreviousPosition

      if (previousPositionOrder !== NO_RANK_CHANGE) {
        return previousPositionOrder
      }

      return firstPlayer.joinedAt.getTime() - secondPlayer.joinedAt.getTime()
    })

    this.leaderboardOrderByRoom.set(
      roomId,
      leaderboard.map((player) => player.id)
    )

    return leaderboard.map((player, index) => {
      const rank = index + FIRST_RANK
      const previousPosition = previousPositionByPlayerId.get(player.id)
      const previousRank = previousPosition === undefined ? null : previousPosition + FIRST_RANK
      const rankChange = previousRank === null ? NO_RANK_CHANGE : previousRank - rank

      return {
        playerId: player.id,
        name: player.displayName,
        score: player.totalScore,
        rank,
        previousRank,
        rankChange,
        connected: player.isConnected,
      }
    })
  }

  private async abandonQuietly(roomId: string): Promise<void> {
    try {
      const room = await this.rooms.findById(roomId)
      if (room && room.status === RoomStatusEnum.ACTIVE) {
        await this.rooms.finishRoom(room, RoomStatusEnum.ABANDONED)
      }
    } catch (error) {
      this.logger.error(`Failed to abandon room ${roomId}: ${String(error)}`)
    }
  }
}
