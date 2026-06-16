/**
 * @file answer-service.test.ts
 */
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { AnswerService } from '../../src/server/room/game/answer.service'
import { GameEventBus } from '../../src/server/room/game/game-event-bus'
import * as EVENTS from '../../src/shared/constants/socket-events.constants'
import type { ClientSocket } from '../../src/server/room/lobby/lobby.types'
import type {
  AnswerAckPayload,
  AnswerSubmitPayload,
  RoundSubmitPayload,
} from '../../src/shared/types/index'

const SOCK_A = { send: (): void => undefined } as ClientSocket
const SOCK_B = { send: (): void => undefined } as ClientSocket

function makeRegistry(): {
  lookup: (s: ClientSocket) => { roomId: string; role: 'client'; clientId: string } | undefined
  getClientSockets: (roomId: string) => ClientSocket[]
  _connected: ClientSocket[]
} {
  const map = new Map<ClientSocket, { roomId: string; role: 'client'; clientId: string }>()
  map.set(SOCK_A, { roomId: 'room-1', role: 'client', clientId: 'pA' })
  map.set(SOCK_B, { roomId: 'room-1', role: 'client', clientId: 'pB' })
  const state = { _connected: [SOCK_A, SOCK_B] }
  return {
    ...state,
    lookup: (s) => map.get(s),
    getClientSockets: () => state._connected,
  }
}

function makeAckCapture(): { acks: Array<{ event: string; data: AnswerAckPayload }> } & {
  emitToSocket: (s: ClientSocket, event: string, data?: unknown) => void
} {
  const acks: Array<{ event: string; data: AnswerAckPayload }> = []
  return {
    acks,
    emitToSocket: (_s, event, data): void =>
      void acks.push({ event, data: data as AnswerAckPayload }),
  }
}

function makeRoomCapture(): {
  rooms: Array<{ roomId: string; event: string; data: unknown }>
  emitToRoom: (roomId: string, event: string, data?: unknown) => void
} {
  const rooms: Array<{ roomId: string; event: string; data: unknown }> = []
  return {
    rooms,
    emitToRoom: (roomId, event, data): void => void rooms.push({ roomId, event, data }),
  }
}

function makeAnswerRepo(): {
  rows: unknown[]
  create: (x: unknown) => unknown
  save: (x: unknown) => Promise<unknown>
} {
  const rows: unknown[] = []
  return {
    rows,
    create: (x) => x,
    save: async (x): Promise<unknown> => {
      rows.push(x)
      return x
    },
  }
}

function makeFailingAnswerRepo(error: unknown): {
  rows: unknown[]
  create: (x: unknown) => unknown
  save: (x: unknown) => Promise<unknown>
} {
  return {
    rows: [],
    create: (x) => x,
    save: async (): Promise<unknown> => {
      throw error
    },
  }
}

const submit = (id: string): AnswerSubmitPayload => ({ answerId: id, timestamp: 0 })

function openWindow(bus: GameEventBus): void {
  bus.publish({
    type: 'ROUND_WINDOW_OPENED',
    roomId: 'room-1',
    roundId: 'round-1',
    roundType: 'quiz',
    scoringMode: 'quiz',
    questionId: 'q1',
    shownAt: Date.now(),
    timeLimitSeconds: 30,
    basePoints: 1000,
    options: [
      { id: 'round-1:0', text: 'Paris', isCorrect: true },
      { id: 'round-1:1', text: 'Berlin', isCorrect: false },
    ],
  })
}

function openMinigameWindow(bus: GameEventBus): void {
  bus.publish({
    type: 'ROUND_WINDOW_OPENED',
    roomId: 'room-1',
    roundId: 'round-1',
    roundType: 'sliding-puzzle',
    scoringMode: 'minigame',
    shownAt: Date.now(),
    timeLimitSeconds: 30,
    privateState: {},
    scoringConfig: {},
  })
}

describe('AnswerService', () => {
  let bus: GameEventBus
  let registry: ReturnType<typeof makeRegistry>
  let ack: ReturnType<typeof makeAckCapture>
  let roomCapture: ReturnType<typeof makeRoomCapture>
  let broadcaster: ReturnType<typeof makeAckCapture> & ReturnType<typeof makeRoomCapture>
  let repo: ReturnType<typeof makeAnswerRepo>
  let service: AnswerService

  beforeEach(() => {
    bus = new GameEventBus()
    registry = makeRegistry()
    ack = makeAckCapture()
    roomCapture = makeRoomCapture()
    broadcaster = { ...ack, ...roomCapture }
    repo = makeAnswerRepo()
    service = new AnswerService(bus, registry as never, broadcaster as never, repo as never)
  })

  it('accepts a valid answer, persists it (storing the answerId), and ACKs accepted', async () => {
    openWindow(bus)
    await service.submit(SOCK_A, submit('round-1:0'))

    assert.equal(repo.rows.length, 1)
    assert.equal((repo.rows[0] as { answerValue: string }).answerValue, 'round-1:0')
    const last = ack.acks[ack.acks.length - 1]
    assert.equal(last?.event, EVENTS.ANSWER_ACK)
    assert.equal(last?.data.accepted, true)
  })

  it('rejects an answer when no window is open', async () => {
    await service.submit(SOCK_A, submit('round-1:0'))
    assert.equal(repo.rows.length, 0)
    assert.equal(ack.acks[ack.acks.length - 1]?.data.reason, 'window-closed')
  })

  it('rejects an unknown answerId', async () => {
    openWindow(bus)
    await service.submit(SOCK_A, submit('round-1:99'))
    assert.equal(repo.rows.length, 0)
    assert.equal(ack.acks[ack.acks.length - 1]?.data.reason, 'invalid-answer')
  })

  it('rejects a duplicate answer from the same client', async () => {
    openWindow(bus)
    await service.submit(SOCK_A, submit('round-1:0'))
    await service.submit(SOCK_A, submit('round-1:1'))
    assert.equal(repo.rows.length, 1)
    assert.equal(ack.acks[ack.acks.length - 1]?.data.reason, 'already-answered')
  })

  it('publishes ALL_PLAYERS_ANSWERED when every connected client has answered', async () => {
    const fired: unknown[] = []
    bus.on('ALL_PLAYERS_ANSWERED').subscribe((e) => fired.push(e))
    openWindow(bus)

    await service.submit(SOCK_A, submit('round-1:0'))
    assert.equal(fired.length, 0)
    await service.submit(SOCK_B, submit('round-1:1'))
    assert.equal(fired.length, 1)
  })

  it('closes the window so later answers are rejected', async () => {
    openWindow(bus)
    bus.publish({
      type: 'ROUND_WINDOW_CLOSED',
      roomId: 'room-1',
      roundId: 'round-1',
      reason: 'expired',
    })
    await service.submit(SOCK_A, submit('round-1:0'))
    assert.equal(repo.rows.length, 0)
    assert.equal(ack.acks[ack.acks.length - 1]?.data.reason, 'window-closed')
  })

  it('clears the window on ROUND_WINDOW_ABORTED so later answers are rejected', async () => {
    openWindow(bus)
    bus.publish({ type: 'ROUND_WINDOW_ABORTED', roomId: 'room-1' })
    await service.submit(SOCK_A, submit('round-1:0'))
    assert.equal(repo.rows.length, 0)
    assert.equal(ack.acks[ack.acks.length - 1]?.data.reason, 'window-closed')
  })

  it('maps a DB unique-violation on save to already-answered', async () => {
    const failing = makeFailingAnswerRepo({ code: '23505' })
    service = new AnswerService(bus, registry as never, broadcaster as never, failing as never)
    openWindow(bus)
    await service.submit(SOCK_A, submit('round-1:0'))
    assert.equal(ack.acks[ack.acks.length - 1]?.data.reason, 'already-answered')
  })

  it('surfaces a non-unique save failure as server-error and lets the client retry', async () => {
    // Repo that throws on the first save, then succeeds — proves the client is
    // removed from the submitted set after a server-error so a retry can land.
    const saved: unknown[] = []
    let calls = 0
    const flaky = {
      rows: saved,
      create: (x: unknown): unknown => x,
      save: async (x: unknown): Promise<unknown> => {
        calls += 1
        if (calls === 1) {
          throw new Error('connection reset')
        }
        saved.push(x)
        return x
      },
    }
    service = new AnswerService(bus, registry as never, broadcaster as never, flaky as never)
    openWindow(bus)

    await service.submit(SOCK_A, submit('round-1:0'))
    assert.equal(ack.acks[ack.acks.length - 1]?.data.reason, 'server-error')

    await service.submit(SOCK_A, submit('round-1:0'))
    assert.equal(ack.acks[ack.acks.length - 1]?.data.accepted, true)
    assert.equal(saved.length, 1)
  })

  it('broadcasts ANSWER_COUNT_UPDATE to the room after a successful submit', async () => {
    openWindow(bus)
    await service.submit(SOCK_A, submit('round-1:0'))

    const rooms = roomCapture.rooms.filter((r) => r.event === EVENTS.ANSWER_COUNT_UPDATE)
    assert.equal(rooms.length, 1)
    assert.equal(rooms[0]?.roomId, 'room-1')
    assert.deepEqual(rooms[0]?.data, { answered: 1, total: 2 })
  })

  it('does not broadcast ANSWER_COUNT_UPDATE when the window is closed', async () => {
    await service.submit(SOCK_A, submit('round-1:0'))

    const rooms = roomCapture.rooms.filter((r) => r.event === EVENTS.ANSWER_COUNT_UPDATE)
    assert.equal(rooms.length, 0)
  })

  it('accepts a procedural round submission and stores it as JSON', async () => {
    const minigames = {
      get: (): unknown => ({ validateSubmission: (): boolean => true }),
    }
    service = new AnswerService(
      bus,
      registry as never,
      broadcaster as never,
      repo as never,
      minigames as never
    )
    openMinigameWindow(bus)

    const payload: RoundSubmitPayload = {
      roundId: 'round-1',
      type: 'sliding-puzzle',
      submission: { board: [1, 2, 3, 4, 5, 6, 7, 8, 0] },
    }
    await service.submitRound(SOCK_A, payload)

    assert.equal(repo.rows.length, 1)
    assert.equal(
      (repo.rows[0] as { answerValue: string }).answerValue,
      JSON.stringify(payload.submission)
    )
    assert.equal(ack.acks[ack.acks.length - 1]?.data.accepted, true)
  })
})
