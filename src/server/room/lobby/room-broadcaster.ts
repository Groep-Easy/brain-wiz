/**
 * @file room-broadcaster.ts
 * @owner server-squad
 * @description The single place that knows the wire format. Pushes
 * `{ event, data }` JSON envelopes to individual sockets or to every socket in
 * a room, using the live sockets held by the ConnectionRegistry.
 */
import 'reflect-metadata'
import { Injectable, Logger } from '@nestjs/common'
import { ConnectionRegistry } from './connection-registry'
import type { ClientSocket } from './lobby.types'
import { ROOM_STATE_UPDATE } from '../../../shared/constants/socket-events.constants'
import type { RoomState } from '../../../shared/types/index'

@Injectable()
export class RoomBroadcaster {
  private readonly logger = new Logger(RoomBroadcaster.name)

  public constructor(private readonly registry: ConnectionRegistry) {}

  public emitToSocket(socket: ClientSocket, event: string, data?: unknown): void {
    this.safeSend(socket, JSON.stringify({ event, data }))
  }

  public emitToRoom(roomId: string, event: string, data?: unknown): void {
    const payload = JSON.stringify({ event, data })
    for (const socket of this.registry.getRoomSockets(roomId)) {
      this.safeSend(socket, payload)
    }
  }

  /**
   * Send to one socket without letting a single dead/erroring socket abort the
   * caller (e.g. a whole room broadcast). On failure the socket is pruned from
   * the registry so it's not retried.
   */
  private safeSend(socket: ClientSocket, payload: string): void {
    try {
      socket.send(payload)
    } catch (error) {
      this.logger.warn(`Dropping unreachable socket: ${String(error)}`)
      this.registry.unregister(socket)
    }
  }

  public broadcastRoomState(roomId: string, state: RoomState): void {
    this.emitToRoom(roomId, ROOM_STATE_UPDATE, { room: state })
  }
}
