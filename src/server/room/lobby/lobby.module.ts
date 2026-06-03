import { Module } from '@nestjs/common'
import { RoomModule } from '../room.module.js'
import { ClientModule } from '../../client/client.module.js'
import { RealtimeModule } from '../../realtime/realtime.module.js'
import { GameModule } from '../game/game.module.js'
import { LobbyService } from './lobby.service.js'
import { SocketGateway } from '../../socket/socket.gateway.js'
import { RateLimiter } from '../../socket/rate-limiter.js'
import { HostAuthThrottle } from '../../socket/host-auth-throttle.js'
import { HeartbeatMonitor } from '../../socket/heartbeat-monitor.js'
import { WS_ALLOWED_ORIGINS } from '../../socket/socket.origin.js'
import { RoomsController } from './room.controller.js'
import { config } from '../../../../config/server.js'

@Module({
  imports: [RoomModule, ClientModule, RealtimeModule, GameModule],
  controllers: [RoomsController],
  providers: [
    LobbyService,
    HeartbeatMonitor,
    { provide: RateLimiter, useFactory: (): RateLimiter => new RateLimiter() },
    { provide: HostAuthThrottle, useFactory: (): HostAuthThrottle => new HostAuthThrottle() },
    { provide: WS_ALLOWED_ORIGINS, useValue: config.CORS_ORIGINS },
    SocketGateway,
  ],
  exports: [LobbyService],
})
export class LobbyModule {}
