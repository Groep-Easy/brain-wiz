/**
 * @file socket.gateway.ts
 * @owner server-squad
 * @description WebSocket gateway (native `ws` transport). A THIN adapter: it
 * parses the connection/message envelope and delegates all business logic to
 * LobbyService. Subscribes to the shared event-name constants — never raw
 * strings.
 *
 * It also owns the connection-level guards that can't live in the business
 * layer: origin allow-listing and host-token brute-force throttling on upgrade,
 * an idle-socket timeout for clients that connect but never join, per-connection
 * inbound rate limiting, a transport `maxPayload` cap, and a server-driven
 * heartbeat that reaps dead sockets.
 */
import { Inject, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type WsResponse,
} from '@nestjs/websockets'
import { randomUUID } from 'node:crypto'
import * as EVENTS from '../../shared/events/socket-events.js'
import { ROOM, WS } from '../../shared/constants/game-config.js'
import type { PingPayload, PlayerJoinPayload, PongPayload } from '../../shared/types/index.js'
import { LobbyService } from '../room/lobby/lobby.service.js'
import { RateLimiter } from './rate-limiter.js'
import { HostAuthThrottle } from './host-auth-throttle.js'
import { HeartbeatMonitor } from './heartbeat-monitor.js'
import { isOriginAllowed, WS_ALLOWED_ORIGINS } from './socket.origin.js'
import {
  clientIp,
  parseHostTokenFromHeaders,
  selectSubprotocol,
  INVALID_TOKEN_CLOSE_CODE,
  INVALID_TOKEN_CLOSE_REASON,
} from './socket-handshake.js'
import type { ConnectParams, IdentifiedSocket, UpgradeRequest } from './socket.types.js'

/** Named sentinel to avoid magic-number lint errors when testing for missing query */
const NO_QUERY_INDEX = -1

/** A socket that supports close(code, reason) at runtime (ws). */
type CloseableSocket = IdentifiedSocket & { close?: (code?: number, reason?: string) => void }

/** Parse `role`/`code` from the WebSocket upgrade request URL.
 * NOTE: `hostToken` query params are disallowed for security reasons; tokens
 * must be supplied via the Sec-WebSocket-Protocol header only.
 */
export function parseConnectParams(url: string | undefined): ConnectParams {
  if (!url) return {}

  const params: ConnectParams = {}
  const queryIndex = url.indexOf('?')
  if (queryIndex === NO_QUERY_INDEX) return params

  const query = url.slice(queryIndex + 1)
  const pairs = query.split('&')
  const map = new Map<string, string>()
  for (const p of pairs) {
    const [k, v] = p.split('=')
    if (k) map.set(decodeURIComponent(k), v ? decodeURIComponent(v) : '')
  }
  const role = map.get('role')
  const code = map.get('code')
  if (role) params.role = role
  if (code) params.code = code
  return params
}

@WebSocketGateway({ maxPayload: WS.MAX_PAYLOAD_BYTES, handleProtocols: selectSubprotocol })
export class SocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(SocketGateway.name)

  public constructor(
    private readonly lobby: LobbyService,
    private readonly rateLimiter: RateLimiter,
    private readonly hostAuth: HostAuthThrottle,
    private readonly heartbeat: HeartbeatMonitor,
    @Inject(WS_ALLOWED_ORIGINS) private readonly allowedOrigins: readonly string[]
  ) {}

  public onModuleInit(): void {
    this.heartbeat.start()
  }

  public onModuleDestroy(): void {
    this.heartbeat.stop()
  }

  public handleConnection(client: IdentifiedSocket, request?: UpgradeRequest): void {
    if (!isOriginAllowed(request?.headers?.origin, this.allowedOrigins)) {
      client.close?.()
      return
    }

    const connectionId = randomUUID()
    client.connectionId = connectionId
    this.heartbeat.track(client)

    const idleTimer = setTimeout(() => this.closeIfIdle(client), ROOM.JOIN_TIMEOUT_MS)
    idleTimer.unref()
    client.idleTimer = idleTimer

    const params = parseConnectParams(request?.url)
    const headerToken = parseHostTokenFromHeaders(request?.headers)

    // If the client sent a token via the query string, reject it explicitly
    // and do not expose the token in logs.
    const url = request?.url
    const hasHostTokenInUrl = typeof url === 'string' && url.includes('hostToken=')
    if (hasHostTokenInUrl) {
      this.logger.warn('Rejected WS connection: token sent via query param')
      ;(client as CloseableSocket).close?.(INVALID_TOKEN_CLOSE_CODE, INVALID_TOKEN_CLOSE_REASON)
      return
    }

    // Host connections MUST supply their token via the Sec-WebSocket-Protocol
    // header. If it's missing, reject with the specific close code + reason.
    if (params.role === 'host') {
      if (!params.code) return
      if (!headerToken) {
        this.logger.warn(
          'Rejected WS connection: host attempted auth without Sec-WebSocket-Protocol token'
        )
        ;(client as CloseableSocket).close?.(INVALID_TOKEN_CLOSE_CODE, INVALID_TOKEN_CLOSE_REASON)
        return
      }
      this.connectHost(params.code, headerToken, connectionId, client, clientIp(request))
    }
  }

  /** Authenticate a host connection, throttling brute-force attempts per IP. */
  private connectHost(
    code: string,
    hostToken: string,
    connectionId: string,
    client: IdentifiedSocket,
    ip: string
  ): void {
    if (this.hostAuth.isLockedOut(ip)) {
      this.logger.warn(`Host auth locked out for ${ip || 'unknown IP'}`)
      client.close?.()
      return
    }
    void this.lobby.connectHost(code, hostToken, connectionId, client).then((accepted) => {
      if (accepted) {
        this.hostAuth.recordSuccess(ip)
      } else {
        this.hostAuth.recordFailure(ip)
        this.logger.warn(`Failed host auth for room ${code} from ${ip || 'unknown IP'}`)
      }
    })
  }

  /** Idle-timeout callback: close the socket unless it has since joined. */
  public closeIfIdle(client: IdentifiedSocket): void {
    if (!this.lobby.isConnectionRegistered(client)) {
      client.close?.()
    }
  }

  public handleDisconnect(client: IdentifiedSocket): void {
    if (client.idleTimer) {
      clearTimeout(client.idleTimer)
      delete client.idleTimer
    }
    this.heartbeat.untrack(client)
    this.rateLimiter.reset(client.connectionId)
    void this.lobby.handleDisconnect(client)
  }

  /**
   * Liveness probe. Echoes the client's timestamp and stamps the server time so
   * the client can measure round-trip latency.
   */
  @SubscribeMessage(EVENTS.PING)
  public handlePing(
    @MessageBody() payload: PingPayload | undefined,
    @ConnectedSocket() client?: IdentifiedSocket
  ): WsResponse<PongPayload> | undefined {
    if (!this.rateLimiter.allow(client?.connectionId)) return undefined
    const t = typeof payload?.t === 'number' ? payload.t : 0
    return { event: EVENTS.PONG, data: { t, serverTime: Date.now() } }
  }

  @SubscribeMessage(EVENTS.PLAYER_JOIN)
  public handlePlayerJoin(
    @MessageBody() payload: PlayerJoinPayload | undefined,
    @ConnectedSocket() client: IdentifiedSocket
  ): void {
    if (!this.rateLimiter.allow(client.connectionId)) return
    if (!payload?.roomCode || !payload?.playerName) return
    void this.lobby.joinClient(
      client,
      client.connectionId ?? '',
      payload.roomCode,
      payload.playerName,
      payload.playerId,
      payload.playerToken
    )
  }

  @SubscribeMessage(EVENTS.PLAYER_LEAVE)
  public handlePlayerLeave(@ConnectedSocket() client: IdentifiedSocket): void {
    if (!this.rateLimiter.allow(client.connectionId)) return
    void this.lobby.leaveClient(client)
  }
}
