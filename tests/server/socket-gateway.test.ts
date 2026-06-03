/**
 * @file socket-gateway.test.ts
 * @owner server-squad
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SocketGateway, parseConnectParams } from '../../src/server/socket/socket.gateway.js'
import type { LobbyService } from '../../src/server/room/lobby/lobby.service.js'
import { PONG } from '../../src/shared/events/socket-events.js'

interface Call {
  method: string
  args: unknown[]
}

/** Records every delegated call so we can assert the gateway wires correctly. */
function fakeLobby(): { service: LobbyService; calls: Call[] } {
  const calls: Call[] = []
  const record =
    (method: string) =>
    async (...args: unknown[]): Promise<unknown> => {
      calls.push({ method, args })
      return Promise.resolve(method === 'connectHost' ? true : undefined)
    }
  const service = {
    connectHost: record('connectHost'),
    joinClient: record('joinClient'),
    leaveClient: record('leaveClient'),
    handleDisconnect: record('handleDisconnect'),
  } as unknown as LobbyService
  return { service, calls }
}

function socket(): { send(d: string): void; connectionId?: string } {
  return { send: (): void => undefined }
}

describe('SocketGateway ping/pong', () => {
  it('answers a ping with a pong envelope', () => {
    const gateway = new SocketGateway(fakeLobby().service)
    assert.equal(gateway.handlePing({ t: 1234 }).event, PONG)
  })
  it('echoes the client timestamp back in the pong', () => {
    const gateway = new SocketGateway(fakeLobby().service)
    assert.equal(gateway.handlePing({ t: 1234 }).data.t, 1234)
  })
  it('defaults the echoed timestamp to 0 when the ping has no payload', () => {
    const gateway = new SocketGateway(fakeLobby().service)
    assert.equal(gateway.handlePing(undefined).data.t, 0)
  })
})

describe('parseConnectParams', () => {
  it('extracts role, code and host token from the upgrade URL', () => {
    const params = parseConnectParams('/?role=host&code=ABCD&hostToken=secret')
    assert.deepEqual(params, { role: 'host', code: 'ABCD', hostToken: 'secret' })
  })
  it('returns an empty object for a missing URL', () => {
    assert.deepEqual(parseConnectParams(undefined), {})
  })
})

describe('SocketGateway connection handling', () => {
  it('assigns a connection id to every new socket', () => {
    const gateway = new SocketGateway(fakeLobby().service)
    const s = socket()
    gateway.handleConnection(s)
    assert.equal(typeof s.connectionId, 'string')
    assert.ok((s.connectionId ?? '').length > 0)
  })

  it('registers a host when the URL carries a valid host role', () => {
    const { service, calls } = fakeLobby()
    const gateway = new SocketGateway(service)
    const s = socket()
    gateway.handleConnection(s, { url: '/?role=host&code=ABCD&hostToken=secret' })
    const call = calls.find((c) => c.method === 'connectHost')
    assert.ok(call)
    assert.deepEqual(call.args.slice(0, 2), ['ABCD', 'secret'])
    assert.equal(call.args[3], s)
  })

  it('does not register a host for a plain client connection', () => {
    const { service, calls } = fakeLobby()
    const gateway = new SocketGateway(service)
    gateway.handleConnection(socket())
    assert.equal(
      calls.find((c) => c.method === 'connectHost'),
      undefined
    )
  })

  it('delegates disconnects to the lobby', () => {
    const { service, calls } = fakeLobby()
    const gateway = new SocketGateway(service)
    const s = socket()
    gateway.handleDisconnect(s)
    assert.deepEqual(calls, [{ method: 'handleDisconnect', args: [s] }])
  })
})

describe('SocketGateway player messages', () => {
  it('delegates PLAYER_JOIN with the connection id and payload', () => {
    const { service, calls } = fakeLobby()
    const gateway = new SocketGateway(service)
    const s = socket()
    gateway.handleConnection(s)
    gateway.handlePlayerJoin({ roomCode: 'ABCD', playerName: 'Alice', playerId: 'p1' }, s)
    const call = calls.find((c) => c.method === 'joinClient')
    assert.ok(call)
    assert.deepEqual(call.args, [s, s.connectionId, 'ABCD', 'Alice', 'p1'])
  })

  it('ignores a PLAYER_JOIN missing required fields', () => {
    const { service, calls } = fakeLobby()
    const gateway = new SocketGateway(service)
    const s = socket()
    gateway.handlePlayerJoin({ roomCode: 'ABCD' } as never, s)
    assert.equal(
      calls.find((c) => c.method === 'joinClient'),
      undefined
    )
  })

  it('delegates PLAYER_LEAVE to the lobby', () => {
    const { service, calls } = fakeLobby()
    const gateway = new SocketGateway(service)
    const s = socket()
    gateway.handlePlayerLeave(s)
    assert.deepEqual(calls, [{ method: 'leaveClient', args: [s] }])
  })
})
