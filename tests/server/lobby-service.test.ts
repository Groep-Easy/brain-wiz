/**
 * @file lobby-service.test.ts
 * @owner server-squad
 * @description Behaviour tests for the lobby orchestrator. Uses the real
 * RoomService/ClientService backed by in-memory fake repositories, the real
 * ConnectionRegistry/RoomBroadcaster, and recording sockets.
 */
import { describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'
import type { Repository } from 'typeorm'
import { LobbyService } from '../../src/server/room/lobby/lobby.service'
import type { GameEngineService } from '../../src/server/room/game/game-engine.service'
import { RoomService } from '../../src/server/room/room.service'
import { ClientService } from '../../src/server/client/client.service'
import { ConnectionRegistry } from '../../src/server/room/lobby/connection-registry'
import { RoomBroadcaster } from '../../src/server/room/lobby/room-broadcaster'
import { RoomNotFoundError } from '../../src/server/room/room.errors'
import {
  NotEnoughPlayersError,
  InvalidHostTokenError,
} from '../../src/server/room/lobby/lobby.errors'
import { Room } from '../../src/server/entities/room.entity'
import { RoomStatusEnum } from '../../src/server/entities/enums'
import { Client } from '../../src/server/entities/client.entity'
import * as EVENTS from '@brain-wiz/shared/constants/socket-events.constants'
import { ROOM, PLAYER } from '@brain-wiz/config/game.config'
import { NAME_REJECTION } from '@brain-wiz/shared/utils/display-name'
import { QuestionService } from '../../src/server/question/question.service.js'
import { FlowService } from '../../src/server/flow/flow.service.js'
import type { Question } from '../../src/server/entities/question.entity.js'
import { GameEventBus } from '../../src/server/room/game/game-event-bus'

interface FakeRoomQueryBuilder {
  where(condition: string, params: Record<string, unknown>): FakeRoomQueryBuilder
  andWhere(condition: string, params: Record<string, unknown>): FakeRoomQueryBuilder
  getOne(): Promise<Room | null>
}

const makeRoomId = (value: number): string =>
  `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`

// ── In-memory fake repositories ──────────────────────────────────────────────
function fakeRoomRepo(): Repository<Room> {
  const store: Room[] = []
  let seq = 0

  return {
    create: (p: Partial<Room>): Room => Object.assign(new Room(), p),

    save: async (r: Room): Promise<Room> => {
      if (!r.id) {
        r.id = makeRoomId(++seq)
      }

      if (!store.includes(r)) {
        store.push(r)
      }

      return r
    },

    createQueryBuilder: (): FakeRoomQueryBuilder => {
      let joinCodeFilter: string | undefined
      let idFilter: string | undefined
      let statusesFilter: RoomStatusEnum[] | undefined

      const queryBuilder: FakeRoomQueryBuilder = {
        where: (condition: string, params: Record<string, unknown>): FakeRoomQueryBuilder => {
          if (condition.includes('room.joinCode')) {
            joinCodeFilter = params['joinCode'] as string
          }

          if (condition.includes('room.id')) {
            idFilter = params['id'] as string
          }

          return queryBuilder
        },

        andWhere: (_condition: string, params: Record<string, unknown>): FakeRoomQueryBuilder => {
          statusesFilter = params['statuses'] as RoomStatusEnum[]
          return queryBuilder
        },

        getOne: async (): Promise<Room | null> => {
          return (
            store.find((room) => {
              if (joinCodeFilter !== undefined && room.joinCode !== joinCodeFilter) {
                return false
              }

              if (idFilter !== undefined && room.id !== idFilter) {
                return false
              }

              if (statusesFilter !== undefined && !statusesFilter.includes(room.status)) {
                return false
              }

              return true
            }) ?? null
          )
        },
      }

      return queryBuilder
    },
  } as unknown as Repository<Room>
}

function fakeClientRepo(): Repository<Client> {
  const store: Client[] = []
  let seq = 0
  return {
    create: (p: Partial<Client>): Client => Object.assign(new Client(), p),
    save: async (c: Client): Promise<Client> => {
      if (!c.id) {
        c.id = `client-${++seq}`
      }
      if (!store.includes(c)) {
        store.push(c)
      }
      return c
    },
    findOne: async (o: { where?: { id?: string } }): Promise<Client | null> =>
      store.find((c) => c.id === o.where?.id) ?? null,
    find: async (o: { where?: { roomId?: string } }): Promise<Client[]> =>
      store.filter((c) => c.roomId === o.where?.roomId),
    remove: async (c: Client): Promise<Client> => {
      const i = store.indexOf(c)
      if (i >= 0) {
        store.splice(i, 1)
      }
      return c
    },
  } as unknown as Repository<Client>
}

function recordingSocket(): {
  sent: Array<{ event: string; data: unknown }>
  send(d: string): void
} {
  const sent: Array<{ event: string; data: unknown }> = []
  return { sent, send: (d: string): void => void sent.push(JSON.parse(d)) }
}

function fakeQuestionService(questionsList: Question[] = []): QuestionService {
  return {
    getRandomQuestion: async (usedIds: string[] = []) => {
      const unused = questionsList.filter((q) => !usedIds.includes(q.id))
      return unused[0] ?? null
    },
  } as unknown as QuestionService
}

function fakeFlowService(): FlowService {
  return {
    getCatalog: async () => [],
    randomize: async () => [],
    normalizeForStorage: async (flow: unknown) => flow,
  } as unknown as FlowService
}

function fakeGameEventBus(): GameEventBus {
  return new GameEventBus()
}

function makeLobby(questions: Question[] = []): LobbyService {
  const rooms = new RoomService(fakeRoomRepo())
  const clients = new ClientService(fakeClientRepo())
  const registry = new ConnectionRegistry()
  const broadcaster = new RoomBroadcaster(registry)
  const noopEngine = {
    run: (): void => undefined,
    abort: (): void => undefined,
    getLivePhase: (): undefined => undefined,
  } as unknown as GameEngineService
  return new LobbyService(
    rooms,
    clients,
    registry,
    broadcaster,
    noopEngine,
    fakeQuestionService(questions),
    fakeFlowService(),
    fakeGameEventBus()
  )
}

function eventsOf(socket: { sent: Array<{ event: string }> }): string[] {
  return socket.sent.map((m) => m.event)
}

describe('LobbyService.createRoom', () => {
  it('creates a lobby room and returns code + host token', async () => {
    const lobby = makeLobby()
    const result = await lobby.createRoom()
    assert.equal(result.code.length, ROOM.CODE_LENGTH)
    assert.ok(result.hostToken.length > 0)
    assert.ok(result.roomId.length > 0)
  })
})

describe('LobbyService.connectHost', () => {
  it('registers the host with a valid token and sends current state', async () => {
    const lobby = makeLobby()
    const { code, hostToken } = await lobby.createRoom()
    const host = recordingSocket()

    const isAccepted = await lobby.connectHost(code, hostToken, 'host-conn', host)

    assert.equal(isAccepted, true)
    assert.ok(eventsOf(host).includes(EVENTS.ROOM_STATE_UPDATE))
  })

  it('rejects a host with an invalid token', async () => {
    const lobby = makeLobby()
    const { code } = await lobby.createRoom()
    const host = recordingSocket()
    const isAccepted = await lobby.connectHost(code, 'wrong-token', 'host-conn', host)
    assert.equal(isAccepted, false)
    assert.equal(eventsOf(host).length, 0)
  })
})

describe('LobbyService.joinClient', () => {
  it('accepts a fresh join: acks the joiner and broadcasts state to the room', async () => {
    const lobby = makeLobby()
    const { code, hostToken } = await lobby.createRoom()
    const host = recordingSocket()
    await lobby.connectHost(code, hostToken, 'host-conn', host)
    const client = recordingSocket()

    await lobby.joinClient(client, { connectionId: 'sock-1', roomCode: code, playerName: 'Alice' })

    const ack = client.sent.find((m) => m.event === EVENTS.PLAYER_JOIN_ACK)
    assert.ok(ack)
    assert.equal((ack.data as { roomCode: string }).roomCode, code)
    assert.ok((ack.data as { playerId: string }).playerId.length > 0)
    // host and joiner both get a state update reflecting the new player
    assert.ok(eventsOf(host).includes(EVENTS.ROOM_STATE_UPDATE))
    assert.ok(eventsOf(client).includes(EVENTS.ROOM_STATE_UPDATE))
  })

  it('rejects an unknown room code', async () => {
    const lobby = makeLobby()
    const client = recordingSocket()
    await lobby.joinClient(client, {
      connectionId: 'sock-1',
      roomCode: 'ZZZZ',
      playerName: 'Alice',
    })
    assert.ok(eventsOf(client).includes(EVENTS.PLAYER_JOIN_REJECTED))
  })

  it('rejects a duplicate display name in the same room', async () => {
    const lobby = makeLobby()
    const { code } = await lobby.createRoom()
    await lobby.joinClient(recordingSocket(), {
      connectionId: 'sock-1',
      roomCode: code,
      playerName: 'Alice',
    })
    const dup = recordingSocket()
    await lobby.joinClient(dup, { connectionId: 'sock-2', roomCode: code, playerName: 'Alice' })
    assert.ok(eventsOf(dup).includes(EVENTS.PLAYER_JOIN_REJECTED))
  })

  it('rejects joining a room that has already started', async () => {
    const lobby = makeLobby()
    const { code, hostToken } = await lobby.createRoom()
    await lobby.joinClient(recordingSocket(), {
      connectionId: 's1',
      roomCode: code,
      playerName: 'Alice',
    })
    await lobby.joinClient(recordingSocket(), {
      connectionId: 's2',
      roomCode: code,
      playerName: 'Bob',
    })
    await lobby.startGame(code, hostToken)
    const late = recordingSocket()
    await lobby.joinClient(late, { connectionId: 's3', roomCode: code, playerName: 'Charlie' })
    assert.ok(eventsOf(late).includes(EVENTS.PLAYER_JOIN_REJECTED))
  })

  it('rejects when the room is full', async () => {
    const lobby = makeLobby()
    const { code } = await lobby.createRoom()
    for (let i = 0; i < ROOM.MAX_PLAYERS; i++) {
      await lobby.joinClient(recordingSocket(), {
        connectionId: `s${i}`,
        roomCode: code,
        playerName: `P${i}`,
      })
    }
    const overflow = recordingSocket()
    await lobby.joinClient(overflow, { connectionId: 'sx', roomCode: code, playerName: 'Late' })
    assert.ok(eventsOf(overflow).includes(EVENTS.PLAYER_JOIN_REJECTED))
  })
})

describe('LobbyService.joinClient input validation', () => {
  it('rejects a malformed room code before any lookup', async () => {
    const lobby = makeLobby()
    const client = recordingSocket()
    await lobby.joinClient(client, { connectionId: 'sock-1', roomCode: 'AB', playerName: 'Alice' }) // too short
    const ack = client.sent.find((m) => m.event === EVENTS.PLAYER_JOIN_REJECTED)
    assert.equal((ack?.data as { reason: string }).reason, 'Invalid room code')
  })

  it('rejects an over-long display name', async () => {
    const lobby = makeLobby()
    const { code } = await lobby.createRoom()
    const client = recordingSocket()
    await lobby.joinClient(client, {
      connectionId: 'sock-1',
      roomCode: code,
      playerName: 'x'.repeat(50),
    })
    const ack = client.sent.find((m) => m.event === EVENTS.PLAYER_JOIN_REJECTED)
    assert.equal(
      (ack?.data as { reason: string }).reason,
      `Display name must be ${PLAYER.NAME_MIN_LENGTH}–${PLAYER.NAME_MAX_LENGTH} characters`
    )
  })

  it('rejects a profane display name', async () => {
    const lobby = makeLobby()
    const { code } = await lobby.createRoom()
    const client = recordingSocket()
    await lobby.joinClient(client, { connectionId: 'sock-1', roomCode: code, playerName: 'kanker' })
    const ack = client.sent.find((m) => m.event === EVENTS.PLAYER_JOIN_REJECTED)
    assert.equal((ack?.data as { reason: string }).reason, NAME_REJECTION.profane)
  })

  it('rejects a reserved display name', async () => {
    const lobby = makeLobby()
    const { code } = await lobby.createRoom()
    const client = recordingSocket()
    await lobby.joinClient(client, { connectionId: 'sock-1', roomCode: code, playerName: 'admin' })
    const ack = client.sent.find((m) => m.event === EVENTS.PLAYER_JOIN_REJECTED)
    assert.equal((ack?.data as { reason: string }).reason, NAME_REJECTION.reserved)
  })

  it('rejects a blank (whitespace-only) display name', async () => {
    const lobby = makeLobby()
    const { code } = await lobby.createRoom()
    const client = recordingSocket()
    await lobby.joinClient(client, { connectionId: 'sock-1', roomCode: code, playerName: '   ' })
    assert.ok(eventsOf(client).includes(EVENTS.PLAYER_JOIN_REJECTED))
  })

  it('trims the display name and dedupes against the trimmed value', async () => {
    const lobby = makeLobby()
    const { code } = await lobby.createRoom()
    await lobby.joinClient(recordingSocket(), {
      connectionId: 's1',
      roomCode: code,
      playerName: '  Alice  ',
    })
    const state = await lobby.getRoomState(code)
    assert.equal(state?.players[0]?.name, 'Alice')
    const dup = recordingSocket()
    await lobby.joinClient(dup, { connectionId: 's2', roomCode: code, playerName: 'Alice' })
    assert.ok(eventsOf(dup).includes(EVENTS.PLAYER_JOIN_REJECTED))
  })
})

describe('LobbyService room teardown clears the host token', () => {
  it('retains the host token initially but drops it after the teardown grace period', async () => {
    mock.timers.enable()
    try {
      const lobby = makeLobby()
      const { code, hostToken } = await lobby.createRoom()
      const client = recordingSocket()
      await lobby.joinClient(client, {
        connectionId: 'sock-1',
        roomCode: code,
        playerName: 'Alice',
      })

      // No host socket connected; the lone client leaving empties the room.
      await lobby.leaveClient(client)

      // Token is retained initially, so the host token is still recognized (throws NotEnoughPlayersError, not InvalidHostTokenError)
      await assert.rejects(async () => lobby.startGame(code, hostToken), NotEnoughPlayersError)

      // Advance time to expire the teardown timer
      mock.timers.tick(ROOM.EMPTY_LOBBY_TEARDOWN_MS + 1000)
      await Promise.resolve()

      // Token is gone, so a host can no longer authenticate against this room.
      await assert.rejects(async () => lobby.startGame(code, hostToken), InvalidHostTokenError)
    } finally {
      mock.timers.reset()
    }
  })
})

describe('LobbyService.leaveClient', () => {
  it('removes the player and broadcasts updated state', async () => {
    const lobby = makeLobby()
    const { code, hostToken } = await lobby.createRoom()
    const host = recordingSocket()
    await lobby.connectHost(code, hostToken, 'host-conn', host)
    const client = recordingSocket()
    await lobby.joinClient(client, { connectionId: 'sock-1', roomCode: code, playerName: 'Alice' })

    await lobby.leaveClient(client)

    const state = await lobby.getRoomState(code)
    assert.equal(state?.players.length, 0)
  })
})

describe('LobbyService disconnect + reconnect grace', () => {
  it('marks disconnected, broadcasts PLAYER_DISCONNECTED, and arms a grace timer', async () => {
    const lobby = makeLobby()
    const { code, hostToken } = await lobby.createRoom()
    const host = recordingSocket()
    await lobby.connectHost(code, hostToken, 'host-conn', host)
    const client = recordingSocket()
    await lobby.joinClient(client, { connectionId: 'sock-1', roomCode: code, playerName: 'Alice' })

    await lobby.handleDisconnect(client)

    assert.ok(eventsOf(host).includes(EVENTS.PLAYER_DISCONNECTED))
    const state = await lobby.getRoomState(code)
    assert.equal(state?.players[0]?.connected, false)
    assert.equal(lobby.hasPendingRemoval(state?.players[0]?.id ?? ''), true)
  })

  it('reconnecting within the grace window restores the player', async () => {
    const lobby = makeLobby()
    const { code, hostToken } = await lobby.createRoom()
    const host = recordingSocket()
    await lobby.connectHost(code, hostToken, 'host-conn', host)
    const first = recordingSocket()
    await lobby.joinClient(first, { connectionId: 'sock-1', roomCode: code, playerName: 'Alice' })
    const ack = first.sent.find((m) => m.event === EVENTS.PLAYER_JOIN_ACK)?.data as {
      playerId: string
      reconnectToken: string
    }
    const { playerId, reconnectToken } = ack
    await lobby.handleDisconnect(first)

    const second = recordingSocket()
    await lobby.joinClient(second, {
      connectionId: 'sock-2',
      roomCode: code,
      playerName: 'Alice',
      playerId: playerId,
      playerToken: reconnectToken,
    })

    assert.ok(eventsOf(host).includes(EVENTS.PLAYER_RECONNECTED))
    assert.equal(lobby.hasPendingRemoval(playerId), false)
    const state = await lobby.getRoomState(code)
    assert.equal(state?.players.length, 1)
    assert.equal(state?.players[0]?.connected, true)
  })

  it('issues a reconnect token on a fresh join', async () => {
    const lobby = makeLobby()
    const { code } = await lobby.createRoom()
    const client = recordingSocket()
    await lobby.joinClient(client, { connectionId: 'sock-1', roomCode: code, playerName: 'Alice' })
    const ack = client.sent.find((m) => m.event === EVENTS.PLAYER_JOIN_ACK)?.data as {
      reconnectToken?: string
    }
    assert.ok(ack.reconnectToken && ack.reconnectToken.length > 0)
  })

  it('rejects a reconnect that presents a wrong (or missing) reconnect token', async () => {
    const lobby = makeLobby()
    const { code, hostToken } = await lobby.createRoom()
    const host = recordingSocket()
    await lobby.connectHost(code, hostToken, 'host-conn', host)
    const first = recordingSocket()
    await lobby.joinClient(first, { connectionId: 'sock-1', roomCode: code, playerName: 'Alice' })
    const playerId = (
      first.sent.find((m) => m.event === EVENTS.PLAYER_JOIN_ACK)?.data as { playerId: string }
    ).playerId
    await lobby.handleDisconnect(first)

    // Attacker knows the (broadcast) playerId but not the secret token.
    const attacker = recordingSocket()
    await lobby.joinClient(attacker, {
      connectionId: 'sock-evil',
      roomCode: code,
      playerName: 'Mallory',
      playerId: playerId,
      playerToken: 'wrong-token',
    })

    assert.ok(eventsOf(attacker).includes(EVENTS.PLAYER_JOIN_REJECTED))
    assert.equal(eventsOf(attacker).includes(EVENTS.PLAYER_RECONNECTED), false)
    // The legitimate player can still be reclaimed and isn't yet removed.
    assert.equal(lobby.hasPendingRemoval(playerId), true)
  })

  it('rotates the reconnect token on each reconnect (no replay of the old one)', async () => {
    const lobby = makeLobby()
    const { code } = await lobby.createRoom()
    const first = recordingSocket()
    await lobby.joinClient(first, { connectionId: 'sock-1', roomCode: code, playerName: 'Alice' })
    const ack1 = first.sent.find((m) => m.event === EVENTS.PLAYER_JOIN_ACK)?.data as {
      playerId: string
      reconnectToken: string
    }
    await lobby.handleDisconnect(first)

    const second = recordingSocket()
    await lobby.joinClient(second, {
      connectionId: 'sock-2',
      roomCode: code,
      playerName: 'Alice',
      playerId: ack1.playerId,
      playerToken: ack1.reconnectToken,
    })
    const ack2 = second.sent.find((m) => m.event === EVENTS.PLAYER_JOIN_ACK)?.data as {
      reconnectToken: string
    }
    assert.notEqual(ack2.reconnectToken, ack1.reconnectToken)

    // The original token must no longer be accepted.
    await lobby.handleDisconnect(second)
    const replay = recordingSocket()
    await lobby.joinClient(replay, {
      connectionId: 'sock-3',
      roomCode: code,
      playerName: 'Alice',
      playerId: ack1.playerId,
      playerToken: ack1.reconnectToken,
    })
    assert.ok(eventsOf(replay).includes(EVENTS.PLAYER_JOIN_REJECTED))
  })

  it('expireGrace removes a client that never reconnected', async () => {
    const lobby = makeLobby()
    const { code, hostToken } = await lobby.createRoom()
    const host = recordingSocket()
    await lobby.connectHost(code, hostToken, 'host-conn', host)
    const client = recordingSocket()
    await lobby.joinClient(client, { connectionId: 'sock-1', roomCode: code, playerName: 'Alice' })
    const playerId = (
      client.sent.find((m) => m.event === EVENTS.PLAYER_JOIN_ACK)?.data as {
        playerId: string
      }
    ).playerId
    await lobby.handleDisconnect(client)

    await lobby.expireGrace(playerId)

    const state = await lobby.getRoomState(code)
    assert.equal(state?.players.length, 0)
  })
})

describe('LobbyService host reconnect grace', () => {
  async function flushMicrotasks(): Promise<void> {
    for (let i = 0; i < 20; i++) {
      await Promise.resolve()
    }
  }

  it('closes the room and evicts players when the host stays gone past the grace window', async () => {
    mock.timers.enable()
    try {
      const lobby = makeLobby()
      const { code, hostToken } = await lobby.createRoom()
      const host = recordingSocket()
      await lobby.connectHost(code, hostToken, 'host-conn', host)
      const player = recordingSocket()
      await lobby.joinClient(player, {
        connectionId: 'sock-1',
        roomCode: code,
        playerName: 'Alice',
      })

      await lobby.handleDisconnect(host)

      assert.equal(eventsOf(player).includes(EVENTS.ROOM_CLOSED), false)

      mock.timers.tick(ROOM.HOST_RECONNECT_GRACE_MS + 1000)
      await flushMicrotasks()

      assert.ok(eventsOf(player).includes(EVENTS.ROOM_CLOSED))
      const late = recordingSocket()
      await lobby.joinClient(late, { connectionId: 'sock-2', roomCode: code, playerName: 'Bob' })
      assert.ok(eventsOf(late).includes(EVENTS.PLAYER_JOIN_REJECTED))
    } finally {
      mock.timers.reset()
    }
  })

  it('keeps the room alive when the host reconnects within the grace window', async () => {
    mock.timers.enable()
    try {
      const lobby = makeLobby()
      const { code, hostToken } = await lobby.createRoom()
      const host = recordingSocket()
      await lobby.connectHost(code, hostToken, 'host-conn', host)
      const player = recordingSocket()
      await lobby.joinClient(player, {
        connectionId: 'sock-1',
        roomCode: code,
        playerName: 'Alice',
      })

      await lobby.handleDisconnect(host)

      const host2 = recordingSocket()
      await lobby.connectHost(code, hostToken, 'host-conn-2', host2)

      mock.timers.tick(ROOM.HOST_RECONNECT_GRACE_MS + 1000)
      await flushMicrotasks()

      assert.equal(eventsOf(player).includes(EVENTS.ROOM_CLOSED), false)
      const late = recordingSocket()
      await lobby.joinClient(late, { connectionId: 'sock-2', roomCode: code, playerName: 'Bob' })
      assert.ok(eventsOf(late).includes(EVENTS.PLAYER_JOIN_ACK))
    } finally {
      mock.timers.reset()
    }
  })
})

describe('LobbyService.startGame', () => {
  it('starts when enough players are connected and broadcasts GAME_START', async () => {
    const lobby = makeLobby()
    const { code, hostToken } = await lobby.createRoom()
    const host = recordingSocket()
    await lobby.connectHost(code, hostToken, 'host-conn', host)
    await lobby.joinClient(recordingSocket(), {
      connectionId: 's1',
      roomCode: code,
      playerName: 'Alice',
    })
    await lobby.joinClient(recordingSocket(), {
      connectionId: 's2',
      roomCode: code,
      playerName: 'Bob',
    })

    const state = await lobby.startGame(code, hostToken)

    assert.equal(state.phase, 'round-intro')
    assert.ok(eventsOf(host).includes(EVENTS.GAME_START))
  })

  it('rejects starting with too few connected players', async () => {
    const lobby = makeLobby()
    const { code, hostToken } = await lobby.createRoom()
    await lobby.joinClient(recordingSocket(), {
      connectionId: 's1',
      roomCode: code,
      playerName: 'Alice',
    })
    await assert.rejects(async () => lobby.startGame(code, hostToken), NotEnoughPlayersError)
  })

  it('rejects an unknown room code', async () => {
    const lobby = makeLobby()
    await assert.rejects(async () => lobby.startGame('ZZZZ', 'tok'), RoomNotFoundError)
  })

  it('rejects an invalid host token', async () => {
    const lobby = makeLobby()
    const { code } = await lobby.createRoom()
    await lobby.joinClient(recordingSocket(), {
      connectionId: 's1',
      roomCode: code,
      playerName: 'Alice',
    })
    await lobby.joinClient(recordingSocket(), {
      connectionId: 's2',
      roomCode: code,
      playerName: 'Bob',
    })
    await assert.rejects(async () => lobby.startGame(code, 'bad-token'), InvalidHostTokenError)
  })
})

describe('LobbyService abort-on-empty', () => {
  function setup(): {
    lobby: LobbyService
    rooms: RoomService
    clients: ClientService
    registry: ConnectionRegistry
    aborted: string[]
  } {
    const rooms = new RoomService(fakeRoomRepo())
    const clients = new ClientService(fakeClientRepo())
    const registry = new ConnectionRegistry()
    const broadcaster = new RoomBroadcaster(registry)
    const aborted: string[] = []
    const gameEngine = {
      run: (): void => undefined,
      abort: (id: string): void => void aborted.push(id),
      getLivePhase: (): undefined => undefined,
    } as unknown as GameEngineService
    const lobby = new LobbyService(
      rooms,
      clients,
      registry,
      broadcaster,
      gameEngine,
      fakeQuestionService(),
      fakeFlowService(),
      fakeGameEventBus()
    )
    return { lobby, rooms, clients, registry, aborted }
  }

  it('aborts the game when the last connected player disconnects mid-game', async () => {
    const { lobby, rooms, registry, aborted } = setup()
    const { code, hostToken, roomId } = await lobby.createRoom()

    const s1 = recordingSocket()
    const s2 = recordingSocket()
    await lobby.joinClient(s1, { connectionId: 'conn-1', roomCode: code, playerName: 'Alice' })
    await lobby.joinClient(s2, { connectionId: 'conn-2', roomCode: code, playerName: 'Bob' })
    await lobby.startGame(code, hostToken)

    await lobby.handleDisconnect(s1)
    assert.deepEqual(aborted, [])

    await lobby.handleDisconnect(s2)
    assert.deepEqual(aborted, [roomId])

    const room = await rooms.findById(roomId)
    assert.ok(room)
    void registry
  })
})

describe('LobbyService disconnect preserves live game phase', () => {
  it('broadcasts the engine live phase (not round-intro) when a player disconnects mid-game', async () => {
    const rooms = new RoomService(fakeRoomRepo())
    const clients = new ClientService(fakeClientRepo())
    const registry = new ConnectionRegistry()
    const broadcaster = new RoomBroadcaster(registry)
    const gameEngine = {
      run: (): void => undefined,
      abort: (): void => undefined,
      getLivePhase: (): string => 'playing',
    } as unknown as GameEngineService
    const lobby = new LobbyService(
      rooms,
      clients,
      registry,
      broadcaster,
      gameEngine,
      fakeQuestionService(),
      fakeFlowService(),
      fakeGameEventBus()
    )

    const { code, hostToken } = await lobby.createRoom()
    const host = recordingSocket()
    await lobby.connectHost(code, hostToken, 'host-conn', host)

    const s1 = recordingSocket()
    const s2 = recordingSocket()
    await lobby.joinClient(s1, { connectionId: 'c1', roomCode: code, playerName: 'Alice' })
    await lobby.joinClient(s2, { connectionId: 'c2', roomCode: code, playerName: 'Bob' })
    await lobby.startGame(code, hostToken)

    await lobby.handleDisconnect(s1)

    const updates = host.sent.filter((m) => m.event === EVENTS.ROOM_STATE_UPDATE)
    const lastUpdate = updates[updates.length - 1]
    assert.ok(lastUpdate, 'host should receive a room-state update on disconnect')
    assert.equal((lastUpdate.data as { room: { phase: string } }).room.phase, 'playing')
  })
})

describe('LobbyService.getRoomState', () => {
  it('returns null for an unknown code', async () => {
    const lobby = makeLobby()
    assert.equal(await lobby.getRoomState('ZZZZ'), null)
  })
  it('reflects the join code and lobby phase', async () => {
    const lobby = makeLobby()
    const { code } = await lobby.createRoom()
    const state = await lobby.getRoomState(code)
    assert.equal(state?.code, code)
    assert.equal(state?.phase, 'lobby')
  })
})

describe('LobbyService.sendQuestionToRoom', () => {
  const sampleQuestion = {
    id: 'q-1',
    text: 'Test Question 1',
  } as unknown as Question

  it('broadcasts the question text to the room and appends question ID to room.usedQuestionsIds when called by a host', async () => {
    const lobby = makeLobby([sampleQuestion])
    const { code, hostToken } = await lobby.createRoom()
    const host = recordingSocket()
    await lobby.connectHost(code, hostToken, 'host-conn', host)

    await lobby.sendQuestionToRoom(host)

    const ack = host.sent.find((m) => m.event === EVENTS.QUESTION_SHOW)
    assert.ok(ack)
    assert.equal((ack.data as { question: string }).question, sampleQuestion.text)

    // Verify duplication avoidance: calling it again with the same question list returns nothing since the only question was already used
    host.sent = []
    await lobby.sendQuestionToRoom(host)
    assert.equal(host.sent.length, 0)
  })

  it('does nothing when the socket is not registered as a host', async () => {
    const lobby = makeLobby([sampleQuestion])
    const client = recordingSocket()

    await lobby.sendQuestionToRoom(client)
    assert.equal(client.sent.length, 0)
  })

  it('does nothing when there are no questions available', async () => {
    const lobby = makeLobby([])
    const { code, hostToken } = await lobby.createRoom()
    const host = recordingSocket()
    await lobby.connectHost(code, hostToken, 'host-conn', host)
    host.sent = [] // clear connection state update event

    await lobby.sendQuestionToRoom(host)
    assert.equal(host.sent.length, 0)
  })
})
