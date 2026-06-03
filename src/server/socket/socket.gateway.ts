/**
 * @file socket.gateway.ts
 * @owner server-squad
 * @description WebSocket gateway (native `ws` transport). A THIN adapter: it
 * parses the connection/message envelope and delegates all business logic to
 * LobbyService. Subscribes to the shared event-name constants — never raw
 * strings.
 */
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
import type { PingPayload, PlayerJoinPayload, PongPayload } from '../../shared/types/index.js'
import { LobbyService } from '../room/lobby/lobby.service.js'
import type { ClientSocket } from '../room/lobby/lobby.types.js'

/** A live socket tagged with the per-connection id we assign on connect. */
export interface IdentifiedSocket extends ClientSocket {
  connectionId?: string
}

export interface ConnectParams {
  role?: string
  code?: string
  hostToken?: string
}

/** Parse `role`/`code`/`hostToken` from the WebSocket upgrade request URL. */
export function parseConnectParams(url: string | undefined): ConnectParams {
  if (!url) {
    return {}
  }
  const search = new URL(url, 'http://localhost').searchParams
  const params: ConnectParams = {}
  const role = search.get('role')
  const code = search.get('code')
  const hostToken = search.get('hostToken')
  if (role) {
    params.role = role
  }
  if (code) {
    params.code = code
  }
  if (hostToken) {
    params.hostToken = hostToken
  }
  return params
}

@WebSocketGateway()
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  public constructor(private readonly lobby: LobbyService) {}

  public handleConnection(client: IdentifiedSocket, request?: { url?: string }): void {
    const connectionId = randomUUID()
    client.connectionId = connectionId
    const params = parseConnectParams(request?.url)
    if (params.role === 'host' && params.code && params.hostToken) {
      void this.lobby.connectHost(params.code, params.hostToken, connectionId, client)
    }
  }

  public handleDisconnect(client: ClientSocket): void {
    void this.lobby.handleDisconnect(client)
  }

  /**
   * Liveness probe. Echoes the client's timestamp and stamps the server time so
   * the client can measure round-trip latency.
   */
  @SubscribeMessage(EVENTS.PING)
  public handlePing(@MessageBody() payload: PingPayload | undefined): WsResponse<PongPayload> {
    const t = typeof payload?.t === 'number' ? payload.t : 0
    return {
      event: EVENTS.PONG,
      data: { t, serverTime: Date.now() },
    }
  }

  @SubscribeMessage(EVENTS.PLAYER_JOIN)
  public handlePlayerJoin(
    @MessageBody() payload: PlayerJoinPayload | undefined,
    @ConnectedSocket() client: IdentifiedSocket
  ): void {
    if (!payload?.roomCode || !payload?.playerName) {
      return
    }
    void this.lobby.joinClient(
      client,
      client.connectionId ?? '',
      payload.roomCode,
      payload.playerName,
      payload.playerId
    )
  }

  @SubscribeMessage(EVENTS.PLAYER_LEAVE)
  public handlePlayerLeave(@ConnectedSocket() client: ClientSocket): void {
    void this.lobby.leaveClient(client)
  }
}
