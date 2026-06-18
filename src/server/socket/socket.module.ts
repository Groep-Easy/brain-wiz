/**
 * @file socket.module.ts
 * @owner server-squad
 * @description WebSocket transport module. Owns the gateway and its
 * connection-level guards (origin allow-list, host-token throttle, idle/heartbeat
 * reaping, inbound rate limiting). Imports LobbyModule and GameModule for the
 * business services the gateway delegates to (LobbyService, AnswerService).
 *
 * Extracted from LobbyModule so the transport layer is its own encapsulated
 * module — peer to the other server modules — instead of loose files wired up by
 * the lobby. The dependency points one way (socket → lobby/game), so there is no
 * module cycle.
 */
import { Module } from '@nestjs/common'
import { LobbyModule } from '../room/lobby/lobby.module'
import { GameModule } from '../room/game/game.module'
import { SocketGateway } from './socket.gateway'
import { RateLimiter } from './rate-limiter'
import { HostAuthThrottle } from './host-auth-throttle'
import { HeartbeatMonitor } from './heartbeat-monitor'
import { WS_ALLOWED_ORIGINS } from './socket.constants'
import { ENV } from '@brain-wiz/config/env.config'

@Module({
  imports: [LobbyModule, GameModule],
  providers: [
    SocketGateway,
    HeartbeatMonitor,
    { provide: RateLimiter, useFactory: (): RateLimiter => new RateLimiter() },
    { provide: HostAuthThrottle, useFactory: (): HostAuthThrottle => new HostAuthThrottle() },
    { provide: WS_ALLOWED_ORIGINS, useValue: ENV.CORS_ORIGINS },
  ],
})
export class SocketModule {}
