/**
 * @file connection-registry.test.ts
 * @owner server-squad
 * @description Unit tests for the in-memory live-socket registry.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ConnectionRegistry } from '../../src/server/room/lobby/connection-registry.js'

/** Minimal fake socket — only identity matters to the registry. */
function fakeSocket(): { send(data: string): void } {
  return { send: (): void => undefined }
}

describe('ConnectionRegistry', () => {
  it('registers a host socket and returns it for the room', () => {
    const reg = new ConnectionRegistry()
    const host = fakeSocket()
    reg.registerHost('room-1', host)
    assert.equal(reg.getHostSocket('room-1'), host)
  })

  it('returns undefined for a room with no host', () => {
    const reg = new ConnectionRegistry()
    assert.equal(reg.getHostSocket('room-x'), undefined)
  })

  it('registers client sockets and lists only the clients of a room', () => {
    const reg = new ConnectionRegistry()
    const a = fakeSocket()
    const b = fakeSocket()
    reg.registerClient('room-1', 'client-a', a)
    reg.registerClient('room-1', 'client-b', b)
    const clients = reg.getClientSockets('room-1')
    assert.equal(clients.length, 2)
    assert.ok(clients.includes(a))
    assert.ok(clients.includes(b))
  })

  it('getRoomSockets returns the host and every client', () => {
    const reg = new ConnectionRegistry()
    const host = fakeSocket()
    const client = fakeSocket()
    reg.registerHost('room-1', host)
    reg.registerClient('room-1', 'client-a', client)
    const all = reg.getRoomSockets('room-1')
    assert.equal(all.length, 2)
    assert.ok(all.includes(host))
    assert.ok(all.includes(client))
  })

  it('looks up the membership of a registered client socket', () => {
    const reg = new ConnectionRegistry()
    const socket = fakeSocket()
    reg.registerClient('room-1', 'client-a', socket)
    assert.deepEqual(reg.lookup(socket), {
      roomId: 'room-1',
      role: 'client',
      clientId: 'client-a',
    })
  })

  it('looks up the membership of a registered host socket', () => {
    const reg = new ConnectionRegistry()
    const socket = fakeSocket()
    reg.registerHost('room-1', socket)
    assert.deepEqual(reg.lookup(socket), { roomId: 'room-1', role: 'host' })
  })

  it('returns undefined when looking up an unknown socket', () => {
    const reg = new ConnectionRegistry()
    assert.equal(reg.lookup(fakeSocket()), undefined)
  })

  it('unregister removes a client and returns its membership', () => {
    const reg = new ConnectionRegistry()
    const socket = fakeSocket()
    reg.registerClient('room-1', 'client-a', socket)
    const membership = reg.unregister(socket)
    assert.deepEqual(membership, { roomId: 'room-1', role: 'client', clientId: 'client-a' })
    assert.equal(reg.getClientSockets('room-1').length, 0)
    assert.equal(reg.lookup(socket), undefined)
  })

  it('unregister returns undefined for an unknown socket', () => {
    const reg = new ConnectionRegistry()
    assert.equal(reg.unregister(fakeSocket()), undefined)
  })

  it('re-registering a client under a new socket replaces the old one (reconnect)', () => {
    const reg = new ConnectionRegistry()
    const oldSocket = fakeSocket()
    const newSocket = fakeSocket()
    reg.registerClient('room-1', 'client-a', oldSocket)
    reg.registerClient('room-1', 'client-a', newSocket)
    const clients = reg.getClientSockets('room-1')
    assert.equal(clients.length, 1)
    assert.equal(clients[0], newSocket)
    assert.equal(reg.lookup(oldSocket), undefined)
  })

  it('stores and verifies a host token for a room', () => {
    const reg = new ConnectionRegistry()
    reg.setHostToken('room-1', 'secret-token')
    assert.equal(reg.verifyHostToken('room-1', 'secret-token'), true)
    assert.equal(reg.verifyHostToken('room-1', 'wrong'), false)
    assert.equal(reg.verifyHostToken('room-1', 'secret-tokeX'), false) // same length, differs
    assert.equal(reg.verifyHostToken('room-unknown', 'secret-token'), false)
  })

  it('clears a host token (room torn down)', () => {
    const reg = new ConnectionRegistry()
    reg.setHostToken('room-1', 'secret-token')
    reg.clearHostToken('room-1')
    assert.equal(reg.verifyHostToken('room-1', 'secret-token'), false)
  })

  it('stores, verifies, rejects and clears a per-client reconnect token', () => {
    const reg = new ConnectionRegistry()
    reg.setReconnectToken('client-a', 'secret')
    assert.equal(reg.verifyReconnectToken('client-a', 'secret'), true)
    assert.equal(reg.verifyReconnectToken('client-a', 'wrong'), false)
    assert.equal(reg.verifyReconnectToken('client-a', undefined), false)
    assert.equal(reg.verifyReconnectToken('client-unknown', 'secret'), false)
    reg.clearReconnectToken('client-a')
    assert.equal(reg.verifyReconnectToken('client-a', 'secret'), false)
  })

  it('tracks reconnect grace timers per client', () => {
    const reg = new ConnectionRegistry()
    const timer = setTimeout((): void => undefined, 10_000)
    reg.setGraceTimer('client-a', timer)
    assert.equal(reg.hasGraceTimer('client-a'), true)
    const cleared = reg.clearGraceTimer('client-a')
    assert.equal(cleared, timer)
    assert.equal(reg.hasGraceTimer('client-a'), false)
    clearTimeout(timer)
  })
})
