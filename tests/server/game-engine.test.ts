/**
 * @file game-engine.test.ts
 * @owner server-squad
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { GameEngineService } from '../../src/server/room/game/game-engine.service'
import { GameEventBus } from '../../src/server/room/game/game-event-bus'
import { TimerOutcome, type PhaseTimerLike } from '../../src/server/room/game/game.types'
import * as EVENTS from '../../src/shared/events/socket-events'
import { ROUNDS } from '../../src/shared/constants/game-config'
import { RoomStatusEnum, RoundStatusEnum } from '../../src/server/entities/enums'
import type { LeaderboardEntry } from '../../src/shared/types/index'

interface RecordingBroadcaster {
  events: string[]
  eventPayloads: unknown[]
  stateBroadcasts: unknown[]
  emitToRoom: (_roomId: string, event: string, payload?: unknown) => void
  broadcastRoomState: (_roomId: string, state: unknown) => void
  broadcastRoadmap: (_roomId: string, payload: unknown) => void
  emitToSocket: () => void
}

function recordingBroadcaster(
  onEmit?: (event: string, payload?: unknown) => void
): RecordingBroadcaster {
  const events: string[] = []
  const eventPayloads: unknown[] = []
  const stateBroadcasts: unknown[] = []
  return {
    events,
    eventPayloads,
    stateBroadcasts,
    emitToRoom: (_roomId: string, event: string, payload?: unknown): void => {
      events.push(event)
      eventPayloads.push(payload)
      onEmit?.(event, payload)
    },
    broadcastRoomState: (_roomId: string, state: unknown): void => void stateBroadcasts.push(state),
    broadcastRoadmap: (): void => undefined,
    emitToSocket: (): void => undefined,
  }
}

interface FakeRoom {
  id: string
  joinCode: string
  status: RoomStatusEnum
  currentRoundIndex: number
  totalRounds: number
  startedAt: Date
}

function fakeRoom(): FakeRoom {
  return {
    id: 'room-1',
    joinCode: 'ABCD',
    status: RoomStatusEnum.ACTIVE,
    currentRoundIndex: 0,
    totalRounds: ROUNDS.COUNT,
    startedAt: new Date(),
  }
}

interface FakeRound {
  id: string
  roomId: string
  roundIndex: number
  status: RoundStatusEnum
  contentType: string
  timeLimitSeconds: number
  questionId: string
}

interface FakeClient {
  id: string
  totalScore: number
  displayName: string
  isConnected: boolean
  joinedAt: Date
}

interface FakeQueryBuilder {
  innerJoinAndSelect: () => FakeQueryBuilder
  where: () => FakeQueryBuilder
  orderBy: () => FakeQueryBuilder
  getMany: () => Promise<unknown[]>
}

function fakeQueryBuilder(): FakeQueryBuilder {
  return {
    innerJoinAndSelect: (): FakeQueryBuilder => fakeQueryBuilder(),
    where: (): FakeQueryBuilder => fakeQueryBuilder(),
    orderBy: (): FakeQueryBuilder => fakeQueryBuilder(),
    getMany: async (): Promise<unknown[]> => [],
  }
}

function fakeRound(index: number): FakeRound {
  return {
    id: `round-${index}`,
    roomId: 'room-1',
    roundIndex: index,
    status: RoundStatusEnum.PENDING,
    contentType: 'question',
    timeLimitSeconds: 30,
    questionId: `q${index}`,
  }
}

function fakeClient(
  id: string,
  displayName: string,
  totalScore: number,
  joinedAt: Date
): FakeClient {
  return {
    id,
    displayName,
    totalScore,
    isConnected: true,
    joinedAt,
  }
}

function autoExpireTimer(): PhaseTimerLike {
  return {
    start: async (): Promise<TimerOutcome> => TimerOutcome.EXPIRED,
    endEarly: (): void => undefined,
    cancel: (): void => undefined,
  }
}

interface ManualTimerResult {
  timer: PhaseTimerLike
  startedPromise: Promise<void>
}

function manualTimer(): ManualTimerResult {
  let resolveFn: ((o: TimerOutcome) => void) | null = null
  let started: (() => void) | null = null
  const startedPromise = new Promise<void>((res) => {
    started = res
  })
  const timer: PhaseTimerLike = {
    start: async (): Promise<TimerOutcome> =>
      new Promise<TimerOutcome>((resolve) => {
        resolveFn = resolve
        started?.()
      }),
    endEarly: (): void => resolveFn?.(TimerOutcome.ENDED_EARLY),
    cancel: (): void => resolveFn?.(TimerOutcome.ABORTED),
  }
  return { timer, startedPromise }
}

interface MakeEngineResult {
  engine: GameEngineService
  broadcaster: RecordingBroadcaster
  finishCalls: RoomStatusEnum[]
  presentCalls: number[]
  room: FakeRoom
  bus: GameEventBus
}

function makeEngine(
  timer: PhaseTimerLike,
  players: FakeClient[] = [fakeClient('p1', 'Player 1', 0, new Date('2026-01-01T00:00:00.000Z'))],
  onEmit?: (event: string, payload?: unknown) => void
): MakeEngineResult {
  const broadcaster = recordingBroadcaster(onEmit)
  const room = fakeRoom()
  const finishCalls: RoomStatusEnum[] = []
  const presentCalls: number[] = []

  const rooms = {
    findById: async (): Promise<unknown> => room,
    setCurrentRound: async (r: { currentRoundIndex: number }, i: number): Promise<unknown> => {
      r.currentRoundIndex = i
      return r
    },
    finishRoom: async (_r: unknown, status: RoomStatusEnum): Promise<unknown> => {
      finishCalls.push(status)
      return room
    },
  }
  const clients = {
    findByRoom: async (): Promise<unknown[]> => players,
  }
  const roundBuilder = {
    buildRounds: async (): Promise<unknown[]> =>
      Array.from({ length: ROUNDS.COUNT }, (_, i) => fakeRound(i)),
  }

  const roundRepo = {
    save: async (r: unknown): Promise<unknown> => r,
    createQueryBuilder: (): FakeQueryBuilder => fakeQueryBuilder(),
  }
  const presenter = {
    present: (_roomId: string, round: { roundIndex: number }): void =>
      void presentCalls.push(round.roundIndex),
  }

  const bus = new GameEventBus()
  bus.on('ROUND_WINDOW_CLOSED').subscribe((e) => {
    bus.publish({ type: 'ROUND_SCORED', roomId: e.roomId, roundId: e.roundId })
  })

  class TestEngine extends GameEngineService {
    protected override createTimer(): PhaseTimerLike {
      return timer
    }
  }
  const engine = new TestEngine(
    broadcaster as never,
    rooms as never,
    clients as never,
    roundBuilder as never,
    roundRepo as never,
    presenter,
    bus
  )
  return { engine, broadcaster, finishCalls, presentCalls, room, bus }
}

describe('GameEngineService', () => {
  it('runs a full game: 5 rounds of phases then GAME_OVER', async () => {
    const { engine, broadcaster, finishCalls, presentCalls } = makeEngine(autoExpireTimer())

    await engine.run('room-1')

    const count = (e: string): number => broadcaster.events.filter((x) => x === e).length
    assert.equal(count(EVENTS.ROUND_START), 5)
    assert.equal(count(EVENTS.GAME_PHASE_CHANGE), 20)
    assert.equal(count(EVENTS.TIMER_EXPIRED), 5)
    assert.equal(count(EVENTS.ROUND_END), 5)
    assert.equal(count(EVENTS.GAME_OVER), 1)
    assert.deepEqual(presentCalls, [0, 1, 2, 3, 4])
    assert.deepEqual(finishCalls, [RoomStatusEnum.FINISHED])
    assert.equal(broadcaster.events[broadcaster.events.length - 1], EVENTS.GAME_OVER)
  })

  it('emits LEADERBOARD_SHOW after each round end with leaderboard payload', async () => {
    const { engine, broadcaster } = makeEngine(autoExpireTimer())

    await engine.run('room-1')

    const leaderboardCount = broadcaster.events.filter((e) => e === EVENTS.LEADERBOARD_SHOW).length
    assert.equal(leaderboardCount, 5)

    const leaderboardPayloads = broadcaster.eventPayloads.filter(
      (_payload, index) => broadcaster.events[index] === EVENTS.LEADERBOARD_SHOW
    )

    assert.equal(leaderboardPayloads.length, 5)
    const leaderboardPayload = leaderboardPayloads[0] as {
      round: unknown
      leaderboard: LeaderboardEntry[]
    }

    assert.equal(leaderboardPayload.leaderboard.length, 1)
    assert.deepEqual(leaderboardPayload.leaderboard[0], {
      playerId: 'p1',
      name: 'Player 1',
      score: 0,
      rank: 1,
      previousRank: null,
      rankChange: 0,
      connected: true,
    })
  })

  it('includes rank movement compared to the previous leaderboard', async () => {
    const playerOne = fakeClient('p1', 'Player 1', 100, new Date('2026-01-01T00:00:00.000Z'))
    const playerTwo = fakeClient('p2', 'Player 2', 50, new Date('2026-01-01T00:00:01.000Z'))
    const players = [playerOne, playerTwo]

    let leaderboardShowCount = 0

    const { engine, broadcaster } = makeEngine(autoExpireTimer(), players, (event) => {
      if (event !== EVENTS.LEADERBOARD_SHOW) {
        return
      }

      leaderboardShowCount += 1

      if (leaderboardShowCount === 1) {
        playerTwo.totalScore = 150
      }
    })

    await engine.run('room-1')

    const leaderboardPayloads = broadcaster.eventPayloads.filter(
      (_payload, index) => broadcaster.events[index] === EVENTS.LEADERBOARD_SHOW
    ) as Array<{ round: unknown; leaderboard: LeaderboardEntry[] }>

    const [firstLeaderboardPayload, secondLeaderboardPayload] = leaderboardPayloads

    assert.ok(firstLeaderboardPayload)
    assert.ok(secondLeaderboardPayload)

    const firstLeaderboard = firstLeaderboardPayload.leaderboard
    const secondLeaderboard = secondLeaderboardPayload.leaderboard

    assert.deepEqual(
      firstLeaderboard.map((player) => ({
        playerId: player.playerId,
        rank: player.rank,
        previousRank: player.previousRank,
        rankChange: player.rankChange,
      })),
      [
        {
          playerId: 'p1',
          rank: 1,
          previousRank: null,
          rankChange: 0,
        },
        {
          playerId: 'p2',
          rank: 2,
          previousRank: null,
          rankChange: 0,
        },
      ]
    )

    assert.deepEqual(
      secondLeaderboard.map((player) => ({
        playerId: player.playerId,
        rank: player.rank,
        previousRank: player.previousRank,
        rankChange: player.rankChange,
      })),
      [
        {
          playerId: 'p2',
          rank: 1,
          previousRank: 2,
          rankChange: 1,
        },
        {
          playerId: 'p1',
          rank: 2,
          previousRank: 1,
          rankChange: -1,
        },
      ]
    )
  })

  it('abort() mid-round stops the loop, abandons the room, emits no GAME_OVER', async () => {
    const { timer, startedPromise } = manualTimer()
    const { engine, broadcaster, finishCalls } = makeEngine(timer)

    const p = engine.run('room-1')
    await startedPromise
    engine.abort('room-1')
    await p

    assert.equal(broadcaster.events.filter((e) => e === EVENTS.GAME_OVER).length, 0)
    assert.deepEqual(finishCalls, [RoomStatusEnum.ABANDONED])
  })

  it('ends the question phase early when ALL_PLAYERS_ANSWERED fires', async () => {
    const { timer, startedPromise } = manualTimer()
    const { engine, broadcaster, bus } = makeEngine(timer)

    const p = engine.run('room-1')
    await startedPromise

    bus.publish({ type: 'ALL_PLAYERS_ANSWERED', roomId: 'room-1', roundId: 'round-0' })

    engine.abort('room-1')
    await p
    assert.ok(broadcaster.events.includes(EVENTS.ROUND_START))
  })

  it('ignores a second run() for a room already running', async () => {
    const { timer, startedPromise } = manualTimer()
    const { engine, broadcaster } = makeEngine(timer)

    const p = engine.run('room-1')
    await startedPromise
    await engine.run('room-1')
    const roundStartsAfterSecondRun = broadcaster.events.filter(
      (e) => e === EVENTS.ROUND_START
    ).length
    engine.abort('room-1')
    await p
    assert.equal(roundStartsAfterSecondRun, 1)
  })
})
