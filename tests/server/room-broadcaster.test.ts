/**
 * @file room-broadcaster.test.ts
 * @owner server-squad
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ConnectionRegistry } from '../../src/server/room/lobby/connection-registry'
import { RoomBroadcaster } from '../../src/server/room/lobby/room-broadcaster'
import { ROOM_STATE_UPDATE, PLAYER_LEAVE } from '../../src/shared/events/socket-events'
import type { RoomState } from '../../src/shared/types/index'

function recordingSocket(): { sent: string[]; send(data: string): void } {
  const sent: string[] = []
  return { sent, send: (data: string): void => void sent.push(data) }
}

const sampleState: RoomState = { code: 'ABCD', players: [], phase: 'lobby', round: 0 }

describe('RoomBroadcaster', () => {
  it('emitToSocket sends a single JSON {event,data} envelope', () => {
    const broadcaster = new RoomBroadcaster(new ConnectionRegistry())
    const socket = recordingSocket()
    broadcaster.emitToSocket(socket, PLAYER_LEAVE, { playerId: 'p1' })
    assert.equal(socket.sent.length, 1)
    assert.deepEqual(JSON.parse(socket.sent[0] ?? ''), {
      event: PLAYER_LEAVE,
      data: { playerId: 'p1' },
    })
  })

  it('emitToRoom delivers to the host and every client', () => {
    const reg = new ConnectionRegistry()
    const host = recordingSocket()
    const a = recordingSocket()
    const b = recordingSocket()
    reg.registerHost('room-1', host)
    reg.registerClient('room-1', 'c-a', a)
    reg.registerClient('room-1', 'c-b', b)
    const broadcaster = new RoomBroadcaster(reg)

    broadcaster.emitToRoom('room-1', PLAYER_LEAVE, { playerId: 'c-a' })

    assert.equal(host.sent.length, 1)
    assert.equal(a.sent.length, 1)
    assert.equal(b.sent.length, 1)
  })

  it('emitToRoom is a no-op for an empty/unknown room', () => {
    const broadcaster = new RoomBroadcaster(new ConnectionRegistry())
    assert.doesNotThrow(() => broadcaster.emitToRoom('nope', PLAYER_LEAVE))
  })

  it('a single throwing socket does not stop delivery to the rest of the room', () => {
    const reg = new ConnectionRegistry()
    const dead = {
      send: (): void => {
        throw new Error('socket closed')
      },
    }
    const a = recordingSocket()
    reg.registerClient('room-1', 'dead', dead)
    reg.registerClient('room-1', 'c-a', a)
    const broadcaster = new RoomBroadcaster(reg)

    assert.doesNotThrow(() => broadcaster.emitToRoom('room-1', PLAYER_LEAVE, { playerId: 'x' }))
    assert.equal(a.sent.length, 1) // healthy socket still received it
    // dead socket was pruned from the registry
    assert.equal(reg.lookup(dead), undefined)
    assert.equal(reg.getClientSockets('room-1').length, 1)
  })

  it('broadcastRoomState wraps the state as ROOM_STATE_UPDATE { room }', () => {
    const reg = new ConnectionRegistry()
    const socket = recordingSocket()
    reg.registerClient('room-1', 'c-a', socket)
    const broadcaster = new RoomBroadcaster(reg)

    broadcaster.broadcastRoomState('room-1', sampleState)

    assert.deepEqual(JSON.parse(socket.sent[0] ?? ''), {
      event: ROOM_STATE_UPDATE,
      data: { room: sampleState },
    })
  })
})
