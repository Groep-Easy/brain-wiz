/**
 * @file lobby.module.ts
 * @description Lobby submodule. Wires the lobby orchestrator with its
 * collaborators (room + client data, in-memory socket registry, broadcaster)
 * and both adapters: the HTTP RoomsController and the WS SocketGateway.
 */
import { Module } from '@nestjs/common'
import { RoomModule } from '../room.module.js'
import { ClientModule } from '../../client/client.module.js'
import { LobbyService } from './lobby.service.js'
import { ConnectionRegistry } from './connection-registry.js'
import { RoomBroadcaster } from './room-broadcaster.js'
import { SocketGateway } from '../../socket/socket.gateway.js'
import { RoomsController } from './room.controller.js'

@Module({
  imports: [RoomModule, ClientModule],
  controllers: [RoomsController],
  providers: [LobbyService, ConnectionRegistry, RoomBroadcaster, SocketGateway],
  exports: [LobbyService],
})
export class LobbyModule {}
