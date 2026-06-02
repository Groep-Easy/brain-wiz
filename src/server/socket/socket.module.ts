/**
 * @file socket.module.ts
 * @owner server-squad
 * @description Socket feature module. Provides the WebSocket gateway and the
 * authoritative room-state store.
 */
import { Module } from '@nestjs/common'
import { SocketGateway } from './socket.gateway.js'
import { RoomManager } from '../core/room-manager.js'

@Module({
  providers: [SocketGateway, RoomManager],
})
export class SocketModule {}
