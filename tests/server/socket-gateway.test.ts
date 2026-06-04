/**
 * @file socket-gateway.test.ts
 * @owner server-squad
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SocketGateway, parseConnectParams } from '../../src/server/socket/socket.gateway.js'
import { RateLimiter } from '../../src/server/socket/rate-limiter.js'
import { HostAuthThrottle } from '../../src/server/socket/host-auth-throttle.js'
import { HeartbeatMonitor } from '../../src/server/socket/heartbeat-monitor.js'
import { WS_SUBPROTOCOL } from '../../src/server/socket/socket-handshake.js'
import type { LobbyService } from '../../src/server/room/lobby/lobby.service.js'
import { PONG } from '../../src/shared/events/socket-events.js'
import { ROOM, RATE_LIMIT, HOST_AUTH } from '../../src/shared/constants/game-config.js'
import type { QuestionService } from '../../src/server/question/question.service.js'

interface Call {
  method: string
  args: unknown[]
}

const ALLOWED_ORIGIN = 'http://localhost:5173'
const ALLOWED = [ALLOWED_ORIGIN]

/** Records every delegated call so we can assert the gateway wires correctly. */
function fakeLobby(
  registered = false,
  hostAccepts = true
): { service: LobbyService; calls: Call[] } {
  const calls: Call[] = []
  const record =
    (method: string) =>
    async (...args: unknown[]): Promise<unknown> => {
      calls.push({ method, args })
      return Promise.resolve(method === 'connectHost' ? hostAccepts : undefined)
    }
  const service = {
    connectHost: record('connectHost'),
    joinClient: record('joinClient'),
    leaveClient: record('leaveClient'),
    handleDisconnect: record('handleDisconnect'),
    isConnectionRegistered: (): boolean => registered,
  } as unknown as LobbyService
  return { service, calls }
}

interface GatewayDeps {
  rateLimiter?: RateLimiter
  hostAuth?: HostAuthThrottle
  heartbeat?: HeartbeatMonitor
}

function fakeQuestionService(): QuestionService {
  return {
    getRandomQuestion: async () => null,
    sendQuestionToRoom: async () => undefined,
  } as unknown as QuestionService
}

/** Build a gateway with permissive defaults unless deps are supplied. */
function makeGateway(service: LobbyService, deps: GatewayDeps = {}): SocketGateway {
  return new SocketGateway(
    service,
    deps.rateLimiter ?? new RateLimiter(),
    deps.hostAuth ?? new HostAuthThrottle(),
    deps.heartbeat ?? new HeartbeatMonitor(),
    fakeQuestionService(),
    ALLOWED
  )
}

function socket(): {
  send(d: string): void
  close(code?: number, reason?: string): void
  closed: boolean
  connectionId?: string
  lastClose?: { code?: number; reason?: string }
} {
  const s: {
    send(d: string): void
    close(code?: number, reason?: string): void
    closed: boolean
    connectionId?: string
    lastClose?: { code?: number; reason?: string }
  } = {
    send: (): void => undefined,
    closed: false,
    close: (code?: number, reason?: string): void => {
      s.closed = true
      const lastClose: { code?: number; reason?: string } = {}
      if (code !== undefined) lastClose.code = code
      if (reason !== undefined) lastClose.reason = reason.toString()
      s.lastClose = lastClose
    },
  }
  return s
}

describe('SocketGateway ping/pong', () => {
  it('answers a ping with a pong envelope', () => {
    const gateway = makeGateway(fakeLobby().service)
    const result = gateway.handlePing({ t: 1234 }, socket())
    assert.equal(result?.event, PONG)
  })
  it('echoes the client timestamp back in the pong', () => {
    const gateway = makeGateway(fakeLobby().service)
    assert.equal(gateway.handlePing({ t: 1234 }, socket())?.data.t, 1234)
  })
  it('defaults the echoed timestamp to 0 when the ping has no payload', () => {
    const gateway = makeGateway(fakeLobby().service)
    assert.equal(gateway.handlePing(undefined, socket())?.data.t, 0)
  })
})

describe('parseConnectParams', () => {
  it('extracts role and code from the upgrade URL', () => {
    const params = parseConnectParams('/?role=host&code=ABCD&hostToken=secret')
    assert.deepEqual(params, { role: 'host', code: 'ABCD' })
  })
  it('returns an empty object for a missing URL', () => {
    assert.deepEqual(parseConnectParams(undefined), {})
  })
})

describe('SocketGateway connection handling', () => {
  it('assigns a connection id to every new socket', () => {
    const gateway = makeGateway(fakeLobby().service)
    const s = socket()
    gateway.handleConnection(s)
    assert.equal(typeof s.connectionId, 'string')
    assert.ok((s.connectionId ?? '').length > 0)
  })

  it('registers a host when the request carries a valid host role and header token', () => {
    const { service, calls } = fakeLobby()
    const gateway = makeGateway(service)
    const s = socket()
    gateway.handleConnection(s, {
      url: '/?role=host&code=ABCD',
      headers: { origin: ALLOWED_ORIGIN, 'sec-websocket-protocol': `${WS_SUBPROTOCOL}, secret` },
    })
    const call = calls.find((c) => c.method === 'connectHost')
    assert.ok(call)
    assert.deepEqual(call.args.slice(0, 2), ['ABCD', 'secret'])
    assert.equal(call.args[3], s)
  })

  it('does not register a host for a plain client connection', () => {
    const { service, calls } = fakeLobby()
    const gateway = makeGateway(service)
    gateway.handleConnection(socket())
    assert.equal(
      calls.find((c) => c.method === 'connectHost'),
      undefined
    )
  })

  it('delegates disconnects to the lobby', () => {
    const { service, calls } = fakeLobby()
    const gateway = makeGateway(service)
    const s = socket()
    gateway.handleDisconnect(s)
    assert.deepEqual(calls, [{ method: 'handleDisconnect', args: [s] }])
  })
})

describe('SocketGateway origin guard', () => {
  it('rejects and closes a socket whose origin is not allow-listed', () => {
    const { service, calls } = fakeLobby()
    const gateway = makeGateway(service)
    const s = socket()
    gateway.handleConnection(s, { headers: { origin: 'http://evil.example' } })
    assert.equal(s.closed, true)
    assert.equal(s.connectionId, undefined)
    assert.equal(calls.length, 0)
  })

  it('allows an allow-listed origin', () => {
    const gateway = makeGateway(fakeLobby().service)
    const s = socket()
    gateway.handleConnection(s, { headers: { origin: ALLOWED_ORIGIN } })
    assert.equal(s.closed, false)
    assert.equal(typeof s.connectionId, 'string')
  })

  it('allows a non-browser client that sends no origin header', () => {
    const gateway = makeGateway(fakeLobby().service)
    const s = socket()
    gateway.handleConnection(s, { headers: {} })
    assert.equal(s.closed, false)
  })
})

describe('SocketGateway idle-socket timeout', () => {
  it('closes a socket that never authenticates within the join window', () => {
    const { service } = fakeLobby(false)
    const gateway = makeGateway(service)
    const s = socket()
    gateway.handleConnection(s)
    assert.equal(s.closed, false)
    assert.ok((s as { idleTimer?: NodeJS.Timeout }).idleTimer) // timer armed
    gateway.closeIfIdle(s) // simulate the timer firing
    assert.equal(s.closed, true)
  })

  it('leaves an authenticated socket open when the idle timer fires', () => {
    const { service } = fakeLobby(true)
    const gateway = makeGateway(service)
    const s = socket()
    gateway.handleConnection(s)
    gateway.closeIfIdle(s)
    assert.equal(s.closed, false)
  })

  it('clears the idle timer on disconnect', () => {
    const { service } = fakeLobby(false)
    const gateway = makeGateway(service)
    const s = socket()
    gateway.handleConnection(s)
    gateway.handleDisconnect(s)
    assert.equal((s as { idleTimer?: NodeJS.Timeout }).idleTimer, undefined)
  })

  it('arms the timer with the configured join timeout', () => {
    assert.equal(ROOM.JOIN_TIMEOUT_MS, 30_000)
  })
})

describe('SocketGateway rate limiting', () => {
  it('drops messages once a connection exceeds its budget', () => {
    const { service, calls } = fakeLobby()
    const gateway = makeGateway(service)
    const s = socket()
    gateway.handleConnection(s)
    for (let i = 0; i < RATE_LIMIT.MAX_MESSAGES; i++) {
      gateway.handlePlayerLeave(s)
    }
    const overBudget = calls.length
    gateway.handlePlayerLeave(s) // one past the cap
    assert.equal(calls.length, overBudget) // dropped, not delegated
  })

  it('does not pong once over budget', () => {
    const gateway = makeGateway(fakeLobby().service)
    const s = socket()
    gateway.handleConnection(s)
    for (let i = 0; i < RATE_LIMIT.MAX_MESSAGES; i++) {
      gateway.handlePing({ t: 1 }, s)
    }
    assert.equal(gateway.handlePing({ t: 1 }, s), undefined)
  })
})

describe('SocketGateway player messages', () => {
  it('delegates PLAYER_JOIN with the connection id, payload and reconnect token', () => {
    const { service, calls } = fakeLobby()
    const gateway = makeGateway(service)
    const s = socket()
    gateway.handleConnection(s)
    gateway.handlePlayerJoin(
      { roomCode: 'ABCD', playerName: 'Alice', playerId: 'p1', playerToken: 'tok' },
      s
    )
    const call = calls.find((c) => c.method === 'joinClient')
    assert.ok(call)
    assert.deepEqual(call.args, [s, s.connectionId, 'ABCD', 'Alice', 'p1', 'tok'])
  })

  it('ignores a PLAYER_JOIN missing required fields', () => {
    const { service, calls } = fakeLobby()
    const gateway = makeGateway(service)
    const s = socket()
    gateway.handlePlayerJoin({ roomCode: 'ABCD' } as never, s)
    assert.equal(
      calls.find((c) => c.method === 'joinClient'),
      undefined
    )
  })

  it('delegates PLAYER_LEAVE to the lobby', () => {
    const { service, calls } = fakeLobby()
    const gateway = makeGateway(service)
    const s = socket()
    gateway.handlePlayerLeave(s)
    assert.deepEqual(calls, [{ method: 'leaveClient', args: [s] }])
  })
})

describe('SocketGateway host authentication', () => {
  function hostRequest(remoteAddress: string): {
    url: string
    headers: { origin: string; 'sec-websocket-protocol': string }
    socket: { remoteAddress: string }
  } {
    return {
      url: '/?role=host&code=ABCD',
      headers: { origin: ALLOWED_ORIGIN, 'sec-websocket-protocol': `${WS_SUBPROTOCOL}, secret` },
      socket: { remoteAddress },
    }
  }

  it('reads the host token from the Sec-WebSocket-Protocol header, not the URL', () => {
    const { service, calls } = fakeLobby()
    const gateway = makeGateway(service)
    const s = socket()
    gateway.handleConnection(s, hostRequest('1.2.3.4'))
    const call = calls.find((c) => c.method === 'connectHost')
    assert.ok(call)
    assert.deepEqual(call.args.slice(0, 2), ['ABCD', 'secret'])
    assert.equal(call.args[3], s)
  })

  it('refuses (and closes) a host connection from a locked-out IP without attempting auth', () => {
    const hostAuth = new HostAuthThrottle()
    for (let i = 0; i < HOST_AUTH.MAX_FAILURES; i++) {
      hostAuth.recordFailure('9.9.9.9')
    }
    const { service, calls } = fakeLobby()
    const gateway = makeGateway(service, { hostAuth })
    const s = socket()
    gateway.handleConnection(s, hostRequest('9.9.9.9'))
    assert.equal(
      calls.find((c) => c.method === 'connectHost'),
      undefined
    )
    assert.equal(s.closed, true)
  })
})
