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
import { Round } from '../../entities/round.entity.js'
import { Room } from '../../entities/room.entity.js'
import { RoomStatusEnum, RoundStatusEnum } from '../../entities/enums.js'
import { RoomService } from '../room.service.js'
import { ClientService } from '../../client/client.service.js'
import { RoomBroadcaster } from '../lobby/room-broadcaster.js'
import { toRoomState } from '../room.helpers.js'
import * as EVENTS from '../../../shared/events/socket-events.js'
import { ROUNDS, TIMER } from '../../../shared/constants/game-config.js'
import type {
  GamePhase as WireGamePhase,
  RoundSummary,
  ScoreMap,
  LeaderboardEntry,
} from '../../../shared/types/index.js'
import {
  GamePhase,
  RoundPresenter,
  TimerOutcome,
  type PhaseTimerLike,
  type RunningGame,
} from './game.types.js'
import { PhaseTimer } from './phase-timer.js'
import { RoundBuilder } from './round-builder.js'
import { ROUND_PRESENTER } from './round-presenter.js'

const PHASE_TO_WIRE: Record<GamePhase, WireGamePhase> = {
  [GamePhase.INTRO]: 'round-intro',
  [GamePhase.QUESTION]: 'playing',
  [GamePhase.REVEAL]: 'reveal',
  [GamePhase.LEADERBOARD]: 'leaderboard',
}

@Injectable()
export class GameEngineService {
  private readonly logger = new Logger(GameEngineService.name)
  private readonly games = new Map<string, RunningGame>()

  public constructor(
    private readonly broadcaster: RoomBroadcaster,
    private readonly rooms: RoomService,
    private readonly clients: ClientService,
    private readonly roundBuilder: RoundBuilder,
    @InjectRepository(Round) private readonly roundRepo: Repository<Round>,
    @Inject(ROUND_PRESENTER) private readonly presenter: RoundPresenter
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
      this.games.delete(roomId)
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
    if (await this.timePhase(room.id, game, TIMER.QUESTION_SECONDS)) {
      return
    }
    this.broadcaster.emitToRoom(room.id, EVENTS.TIMER_EXPIRED)

    if (await this.runPhase(room, game, GamePhase.REVEAL, TIMER.REVEAL_SECONDS)) {
      return
    }

    await this.markRound(round, RoundStatusEnum.FINISHED)
    this.broadcaster.emitToRoom(room.id, EVENTS.ROUND_END, {
      scores: await this.buildScores(room.id),
    })

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
    const roster = await this.clients.findByRoom(roomId)

    return [...roster]
      .sort((a, b) => b.totalScore - a.totalScore || a.displayName.localeCompare(b.displayName))
      .map((client, index) => ({
        playerId: client.id,
        name: client.displayName,
        score: client.totalScore,
        rank: index + 1,
        connected: client.isConnected,
      }))
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
