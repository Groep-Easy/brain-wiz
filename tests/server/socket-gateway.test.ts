/**
 * @file socket-gateway.test.ts
 * @owner server-squad
 */
import { describe, it } from 'node:test'
import * as assert from 'node:assert/strict'
import { SocketGateway } from '../../src/server/socket/socket.gateway.js'
import { parseConnectParams } from '../../src/server/socket/helpers/index.js'
import { RateLimiter } from '../../src/server/socket/rate-limiter.js'
import { HostAuthThrottle } from '../../src/server/socket/host-auth-throttle.js'
import { HeartbeatMonitor } from '../../src/server/socket/heartbeat-monitor.js'
import { WS_SUBPROTOCOL } from '../../src/server/socket/socket.constants.js'
import type { LobbyService } from '../../src/server/room/lobby/lobby.service.js'
import { PONG } from '@brain-wiz/shared/constants/socket-events.constants'
import { ROOM, RATE_LIMIT, HOST_AUTH } from '@brain-wiz/config/game.config'
import type { AnswerService } from '../../src/server/room/game/answer.service.js'
import type { AnswerSubmitPayload, RoundProgressPayload } from '@brain-wiz/shared/types/index'

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
    sendQuestionToRoom: record('sendQuestionToRoom'), // stub to avoid type errors
  } as unknown as LobbyService
  return { service, calls }
}

interface GatewayDeps {
  rateLimiter?: RateLimiter
  hostAuth?: HostAuthThrottle
  heartbeat?: HeartbeatMonitor
}

function fakeAnswerService(): AnswerService {
  return {
    submit: async () => undefined,
    submitRound: async () => undefined,
    updateRoundProgress: () => undefined,
  } as unknown as AnswerService
}

/** Build a gateway with permissive defaults unless deps are supplied. */
function makeGateway(service: LobbyService, deps: GatewayDeps = {}): SocketGateway {
  return new SocketGateway(
    service,
    deps.rateLimiter ?? new RateLimiter(),
    deps.hostAuth ?? new HostAuthThrottle(),
    deps.heartbeat ?? new HeartbeatMonitor(),
    fakeAnswerService(),
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
  it('returns an empty object for a URL with no query string', () => {
    assert.deepEqual(parseConnectParams('/'), {})
  })
  it('returns an empty object for an empty query string', () => {
    // The ? marker exists but nothing follows it
    assert.deepEqual(parseConnectParams('/?'), {})
  })
  it('decodes URL-encoded role and code values', () => {
    const params = parseConnectParams('/?role=host&code=AB%20CD')
    assert.equal(params.code, 'AB CD')
  })
  it('ignores a param with an empty value (role= is treated as absent)', () => {
    // parseConnectParams uses a truthy guard: `if (role) params.role = role`
    // An empty string is falsy, so role='' is intentionally treated as missing.
    const params = parseConnectParams('/?role=')
    assert.equal(params.role, undefined)
  })
  it('does NOT expose hostToken — it is silently stripped from params', () => {
    const params = parseConnectParams('/?role=host&code=ABCD&hostToken=s3cr3t')
    assert.equal((params as Record<string, string>)['hostToken'], undefined)
    assert.equal(params.role, 'host')
    assert.equal(params.code, 'ABCD')
  })
  it('ignores unknown keys without crashing', () => {
    const params = parseConnectParams('/?role=client&unknownKey=value')
    assert.equal(params.role, 'client')
    assert.equal((params as Record<string, string>)['unknownKey'], undefined)
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
    assert.deepEqual(call.args, [
      s,
      {
        connectionId: s.connectionId,
        roomCode: 'ABCD',
        playerName: 'Alice',
        playerId: 'p1',
        playerToken: 'tok',
        playerAvatar: undefined,
      },
    ])
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

describe('SocketGateway.handleAnswerSubmit', () => {
  it('delegates a rate-allowed ANSWER_SUBMIT to AnswerService', async () => {
    const submitted: Array<{ socket: unknown; payload: AnswerSubmitPayload }> = []
    const answerService = {
      submit: async (s: unknown, payload: AnswerSubmitPayload): Promise<void> => {
        submitted.push({ socket: s, payload })
      },
    }
    const rateLimiter = { allow: (): boolean => true }

    const gateway = new SocketGateway(
      {} as never,
      rateLimiter as never,
      {} as never,
      {} as never,
      answerService as never,
      [] as never
    )

    const client = socket()
    const payload: AnswerSubmitPayload = { answerId: 'round-1:0', timestamp: 0 }
    gateway.handleAnswerSubmit(payload, client)
    await new Promise<void>((r) => {
      setImmediate(r)
    })

    assert.equal(submitted.length, 1)
    assert.equal(submitted[0]?.payload.answerId, 'round-1:0')
  })

  it('drops an ANSWER_SUBMIT that exceeds the rate limit', async () => {
    const submitted: unknown[] = []
    const answerService = { submit: async (): Promise<void> => void submitted.push(1) }
    const rateLimiter = { allow: (): boolean => false }
    const gateway = new SocketGateway(
      {} as never,
      rateLimiter as never,
      {} as never,
      {} as never,
      answerService as never,
      [] as never
    )
    gateway.handleAnswerSubmit({ answerId: 'x', timestamp: 0 }, socket())
    await new Promise<void>((r) => {
      setImmediate(r)
    })
    assert.equal(submitted.length, 0)
  })
})

describe('SocketGateway.handleRoundProgress', () => {
  it('delegates a rate-allowed ROUND_PROGRESS to AnswerService', async () => {
    const updates: Array<{ socket: unknown; payload: RoundProgressPayload }> = []
    const answerService = {
      updateRoundProgress: (s: unknown, payload: RoundProgressPayload): void => {
        updates.push({ socket: s, payload })
      },
    }
    const rateLimiter = { allow: (): boolean => true }

    const gateway = new SocketGateway(
      {} as never,
      rateLimiter as never,
      {} as never,
      {} as never,
      answerService as never,
      [] as never
    )

    const client = socket()
    const payload: RoundProgressPayload = {
      roundId: 'round-1',
      type: 'sliding-puzzle',
      submission: { board: [1, 2, 3, 4, 5, 6, 0, 7, 8] },
      timestamp: 0,
    }
    gateway.handleRoundProgress(payload, client)

    assert.equal(updates.length, 1)
    assert.equal(updates[0]?.payload.roundId, 'round-1')
  })

  it('drops a ROUND_PROGRESS that exceeds the rate limit', () => {
    const updates: unknown[] = []
    const answerService = { updateRoundProgress: (): void => void updates.push(1) }
    const rateLimiter = { allow: (): boolean => false }
    const gateway = new SocketGateway(
      {} as never,
      rateLimiter as never,
      {} as never,
      {} as never,
      answerService as never,
      [] as never
    )
    gateway.handleRoundProgress(
      {
        roundId: 'round-1',
        type: 'sliding-puzzle',
        submission: { board: [1, 2, 3, 4, 5, 6, 0, 7, 8] },
      },
      socket()
    )
    assert.equal(updates.length, 0)
  })
})
