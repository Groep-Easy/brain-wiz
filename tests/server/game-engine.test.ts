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

interface RecordingBroadcaster {
  events: string[]
  stateBroadcasts: unknown[]
  emitToRoom: (_roomId: string, event: string) => void
  broadcastRoomState: (_roomId: string, state: unknown) => void
  emitToSocket: () => void
}

function recordingBroadcaster(): RecordingBroadcaster {
  const events: string[] = []
  const stateBroadcasts: unknown[] = []
  return {
    events,
    stateBroadcasts,
    emitToRoom: (_roomId: string, event: string): void => void events.push(event),
    broadcastRoomState: (_roomId: string, state: unknown): void => void stateBroadcasts.push(state),
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

function makeEngine(timer: PhaseTimerLike): MakeEngineResult {
  const broadcaster = recordingBroadcaster()
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
    findByRoom: async (): Promise<unknown[]> => [{ id: 'p1', totalScore: 0 }],
  }
  const roundBuilder = {
    buildRounds: async (): Promise<unknown[]> =>
      Array.from({ length: ROUNDS.COUNT }, (_, i) => fakeRound(i)),
  }
  const roundRepo = { save: async (r: unknown): Promise<unknown> => r }
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
    assert.equal(count(EVENTS.GAME_PHASE_CHANGE), 15)
    assert.equal(count(EVENTS.TIMER_EXPIRED), 5)
    assert.equal(count(EVENTS.ROUND_END), 5)
    assert.equal(count(EVENTS.GAME_OVER), 1)
    assert.deepEqual(presentCalls, [0, 1, 2, 3, 4])
    assert.deepEqual(finishCalls, [RoomStatusEnum.FINISHED])
    assert.equal(broadcaster.events[broadcaster.events.length - 1], EVENTS.GAME_OVER)
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
