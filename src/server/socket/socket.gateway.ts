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
import {
  Inject,
  Logger,
  UsePipes,
  ValidationPipe,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common'
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
import * as EVENTS from '../../shared/events/socket-events'
import { ROOM, WS } from '../../shared/constants/game-config'
import { AnswerService } from '../room/game/answer.service'
import type { PongPayload } from '../../shared/types/index'
import { PingDto, PlayerJoinDto, AnswerSubmitDto, RoundSubmitDto } from './dto/socket.dto'
import { LobbyService } from '../room/lobby/lobby.service'
import { RateLimiter } from './rate-limiter'
import { HostAuthThrottle } from './host-auth-throttle'
import { HeartbeatMonitor } from './heartbeat-monitor'
import type { CloseableSocket, IdentifiedSocket, UpgradeRequest } from './socket.types'
import {
  parseConnectParams,
  clientIp,
  parseHostTokenFromHeaders,
  selectSubprotocol,
} from './helpers/index'
import { isOriginAllowed } from './utils/index'
import {
  WS_ALLOWED_ORIGINS,
  INVALID_TOKEN_CLOSE_CODE,
  INVALID_TOKEN_CLOSE_REASON,
  ROOM_NOT_FOUND_CLOSE_CODE,
  ROOM_NOT_FOUND_CLOSE_REASON,
} from './socket.constants'

@WebSocketGateway({ maxPayload: WS.MAX_PAYLOAD_BYTES, handleProtocols: selectSubprotocol })
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
export class SocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(SocketGateway.name)

  public constructor(
    private readonly lobby: LobbyService,
    private readonly rateLimiter: RateLimiter,
    private readonly hostAuth: HostAuthThrottle,
    private readonly heartbeat: HeartbeatMonitor,
    private readonly answerService: AnswerService,
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

    const url = request?.url
    const hasHostTokenInUrl = typeof url === 'string' && url.includes('hostToken=')
    if (hasHostTokenInUrl) {
      this.logger.warn('Rejected WS connection: token sent via query param')
      ;(client as CloseableSocket).close?.(INVALID_TOKEN_CLOSE_CODE, INVALID_TOKEN_CLOSE_REASON)
      return
    }

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
        ;(client as CloseableSocket).close?.(ROOM_NOT_FOUND_CLOSE_CODE, ROOM_NOT_FOUND_CLOSE_REASON)
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
    @MessageBody() payload: PingDto | undefined,
    @ConnectedSocket() client?: IdentifiedSocket
  ): WsResponse<PongPayload> | undefined {
    if (!this.rateLimiter.allow(client?.connectionId)) return undefined
    const t = typeof payload?.t === 'number' ? payload.t : 0
    return { event: EVENTS.PONG, data: { t, serverTime: Date.now() } }
  }

  @SubscribeMessage(EVENTS.PLAYER_JOIN)
  public handlePlayerJoin(
    @MessageBody() payload: PlayerJoinDto | undefined,
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
      payload.playerToken,
      payload.playerAvatar
    )
  }

  @SubscribeMessage(EVENTS.PLAYER_LEAVE)
  public handlePlayerLeave(@ConnectedSocket() client: IdentifiedSocket): void {
    if (!this.rateLimiter.allow(client.connectionId)) return
    void this.lobby.leaveClient(client)
  }

  @SubscribeMessage(EVENTS.QUESTION_SHOW)
  public handleQuestionShow(@ConnectedSocket() client: IdentifiedSocket): void {
    void this.lobby.sendQuestionToRoom(client)
  }

  @SubscribeMessage(EVENTS.ANSWER_SUBMIT)
  public handleAnswerSubmit(
    @MessageBody() payload: AnswerSubmitDto | undefined,
    @ConnectedSocket() client: IdentifiedSocket
  ): void {
    if (!this.rateLimiter.allow(client.connectionId)) return
    if (!payload?.answerId) return
    void this.answerService.submit(client, payload)
  }

  @SubscribeMessage(EVENTS.ROUND_SUBMIT)
  public handleRoundSubmit(
    @MessageBody() payload: RoundSubmitDto | undefined,
    @ConnectedSocket() client: IdentifiedSocket
  ): void {
    if (!this.rateLimiter.allow(client.connectionId)) return
    if (!payload?.roundId || !payload?.type) return
    void this.answerService.submitRound(client, payload)
  }
}
