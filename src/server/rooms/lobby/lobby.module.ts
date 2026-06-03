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
import { RateLimiter } from '../../socket/rate-limiter.js'
import { WS_ALLOWED_ORIGINS } from '../../socket/socket.origin.js'
import { RoomsController } from './room.controller.js'
import { config } from '../../../../config/server.js'

@Module({
  imports: [RoomModule, ClientModule],
  controllers: [RoomsController],
  providers: [
    LobbyService,
    ConnectionRegistry,
    RoomBroadcaster,
    // RateLimiter's only constructor arg is a test clock seam (defaulting to
    // Date.now), which Nest's DI can't resolve — build it explicitly here.
    { provide: RateLimiter, useFactory: (): RateLimiter => new RateLimiter() },
    // Origins allowed to open a WebSocket — mirrors the HTTP CORS allow-list.
    { provide: WS_ALLOWED_ORIGINS, useValue: config.CORS_ORIGINS },
    SocketGateway,
  ],
  exports: [LobbyService],
})
export class LobbyModule {}

