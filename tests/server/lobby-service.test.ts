/**
 * @file lobby-service.test.ts
 * @owner server-squad
 * @description Behaviour tests for the lobby orchestrator. Uses the real
 * RoomService/ClientService backed by in-memory fake repositories, the real
 * ConnectionRegistry/RoomBroadcaster, and recording sockets.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Repository } from 'typeorm'
import { LobbyService } from '../../src/server/room/lobby/lobby.service.js'
import { RoomService } from '../../src/server/room/room.service.js'
import { ClientService } from '../../src/server/client/client.service.js'
import { ConnectionRegistry } from '../../src/server/room/lobby/connection-registry.js'
import { RoomBroadcaster } from '../../src/server/room/lobby/room-broadcaster.js'
import { RoomNotFoundError } from '../../src/server/room/room.errors.js'
import {
  NotEnoughPlayersError,
  InvalidHostTokenError,
} from '../../src/server/room/lobby/lobby.errors.js'
import { Room } from '../../src/server/entities/room.entity.js'
import { Client } from '../../src/server/entities/client.entity.js'
import * as EVENTS from '../../src/shared/events/socket-events.js'
import { ROOM } from '../../src/shared/constants/game-config.js'

// ── In-memory fake repositories ──────────────────────────────────────────────
function fakeRoomRepo(): Repository<Room> {
  const store: Room[] = []
  let seq = 0
  return {
    create: (p: Partial<Room>): Room => Object.assign(new Room(), p),
    save: async (r: Room): Promise<Room> => {
      if (!r.id) {
        r.id = `room-${++seq}`
      }
      if (!store.includes(r)) {
        store.push(r)
      }
      return r
    },
    findOne: async (o: { where?: { id?: string; joinCode?: string } }): Promise<Room | null> => {
      const w = o.where ?? {}
      return (
        store.find(
          (r) => (w.id ? r.id === w.id : true) && (w.joinCode ? r.joinCode === w.joinCode : true)
        ) ?? null
      )
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

function makeLobby(): LobbyService {
  const rooms = new RoomService(fakeRoomRepo())
  const clients = new ClientService(fakeClientRepo())
  const registry = new ConnectionRegistry()
  const broadcaster = new RoomBroadcaster(registry)
  return new LobbyService(rooms, clients, registry, broadcaster)
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

    await lobby.joinClient(client, 'sock-1', code, 'Alice')

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
    await lobby.joinClient(client, 'sock-1', 'ZZZZ', 'Alice')
    assert.ok(eventsOf(client).includes(EVENTS.PLAYER_JOIN_REJECTED))
  })

  it('rejects a duplicate display name in the same room', async () => {
    const lobby = makeLobby()
    const { code } = await lobby.createRoom()
    await lobby.joinClient(recordingSocket(), 'sock-1', code, 'Alice')
    const dup = recordingSocket()
    await lobby.joinClient(dup, 'sock-2', code, 'Alice')
    assert.ok(eventsOf(dup).includes(EVENTS.PLAYER_JOIN_REJECTED))
  })

  it('rejects joining a room that has already started', async () => {
    const lobby = makeLobby()
    const { code, hostToken } = await lobby.createRoom()
    await lobby.joinClient(recordingSocket(), 's1', code, 'Alice')
    await lobby.joinClient(recordingSocket(), 's2', code, 'Bob')
    await lobby.startGame(code, hostToken)
    const late = recordingSocket()
    await lobby.joinClient(late, 's3', code, 'Charlie')
    assert.ok(eventsOf(late).includes(EVENTS.PLAYER_JOIN_REJECTED))
  })

  it('rejects when the room is full', async () => {
    const lobby = makeLobby()
    const { code } = await lobby.createRoom()
    for (let i = 0; i < ROOM.MAX_PLAYERS; i++) {
      await lobby.joinClient(recordingSocket(), `s${i}`, code, `P${i}`)
    }
    const overflow = recordingSocket()
    await lobby.joinClient(overflow, 'sx', code, 'Late')
    assert.ok(eventsOf(overflow).includes(EVENTS.PLAYER_JOIN_REJECTED))
  })
})

describe('LobbyService.leaveClient', () => {
  it('removes the player and broadcasts updated state', async () => {
    const lobby = makeLobby()
    const { code, hostToken } = await lobby.createRoom()
    const host = recordingSocket()
    await lobby.connectHost(code, hostToken, 'host-conn', host)
    const client = recordingSocket()
    await lobby.joinClient(client, 'sock-1', code, 'Alice')

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
    await lobby.joinClient(client, 'sock-1', code, 'Alice')

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
    await lobby.joinClient(first, 'sock-1', code, 'Alice')
    const playerId = (
      first.sent.find((m) => m.event === EVENTS.PLAYER_JOIN_ACK)?.data as {
        playerId: string
      }
    ).playerId
    await lobby.handleDisconnect(first)

    const second = recordingSocket()
    await lobby.joinClient(second, 'sock-2', code, 'Alice', playerId)

    assert.ok(eventsOf(host).includes(EVENTS.PLAYER_RECONNECTED))
    assert.equal(lobby.hasPendingRemoval(playerId), false)
    const state = await lobby.getRoomState(code)
    assert.equal(state?.players.length, 1)
    assert.equal(state?.players[0]?.connected, true)
  })

  it('expireGrace removes a client that never reconnected', async () => {
    const lobby = makeLobby()
    const { code, hostToken } = await lobby.createRoom()
    const host = recordingSocket()
    await lobby.connectHost(code, hostToken, 'host-conn', host)
    const client = recordingSocket()
    await lobby.joinClient(client, 'sock-1', code, 'Alice')
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

describe('LobbyService.startGame', () => {
  it('starts when enough players are connected and broadcasts GAME_START', async () => {
    const lobby = makeLobby()
    const { code, hostToken } = await lobby.createRoom()
    const host = recordingSocket()
    await lobby.connectHost(code, hostToken, 'host-conn', host)
    await lobby.joinClient(recordingSocket(), 's1', code, 'Alice')
    await lobby.joinClient(recordingSocket(), 's2', code, 'Bob')

    const state = await lobby.startGame(code, hostToken)

    assert.equal(state.phase, 'round-intro')
    assert.ok(eventsOf(host).includes(EVENTS.GAME_START))
  })

  it('rejects starting with too few connected players', async () => {
    const lobby = makeLobby()
    const { code, hostToken } = await lobby.createRoom()
    await lobby.joinClient(recordingSocket(), 's1', code, 'Alice')
    await assert.rejects(async () => lobby.startGame(code, hostToken), NotEnoughPlayersError)
  })

  it('rejects an unknown room code', async () => {
    const lobby = makeLobby()
    await assert.rejects(async () => lobby.startGame('ZZZZ', 'tok'), RoomNotFoundError)
  })

  it('rejects an invalid host token', async () => {
    const lobby = makeLobby()
    const { code } = await lobby.createRoom()
    await lobby.joinClient(recordingSocket(), 's1', code, 'Alice')
    await lobby.joinClient(recordingSocket(), 's2', code, 'Bob')
    await assert.rejects(async () => lobby.startGame(code, 'bad-token'), InvalidHostTokenError)
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
