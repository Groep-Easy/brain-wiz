/**
 * @file socket.gateway.ts
 * @owner server-squad
 * @description WebSocket gateway (native `ws` transport). Replaces the old
 * Socket.io `socket/handlers.ts`. Subscribes to the shared event-name
 * constants — never use raw strings.
 *
 * NOTE: handler bodies are intentionally NOT implemented yet — TODOs only.
 */
import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type WsResponse,
} from '@nestjs/websockets'
import * as EVENTS from '../../shared/events/socket-events.js'
import type { PingPayload, PongPayload } from '../../shared/types/index.js'

// TODO: inject `RoomManager` (provided by SocketModule) once handlers are
// implemented, e.g. `constructor(private readonly roomManager: RoomManager) {}`

@WebSocketGateway()
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  public handleConnection(client: unknown): void {
    // TODO: implement in week 1
    void client
  }

  public handleDisconnect(client: unknown): void {
    // TODO: handle reconnect window in week 1
    void client
  }

  /**
   * Liveness probe. Echoes the client's timestamp and stamps the server time
   * so the client can measure round-trip latency. The native `ws` adapter
   * sends this returned `WsResponse` back as `{ event, data }`.
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
  public handlePlayerJoin(payload: unknown): void {
    // TODO: implement in week 1
    void payload
  }

  @SubscribeMessage(EVENTS.PLAYER_LEAVE)
  public handlePlayerLeave(): void {
    // TODO: implement in week 1
  }

  @SubscribeMessage(EVENTS.GAME_START)
  public handleGameStart(): void {
    // TODO: implement in week 2
  }

  @SubscribeMessage(EVENTS.ANSWER_SUBMIT)
  public handleAnswerSubmit(payload: unknown): void {
    // TODO: implement in week 2
    void payload
  }
}
