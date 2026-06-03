import { Module } from '@nestjs/common'
import { RoomModule } from '../room.module'
import { ClientModule } from '../../client/client.module'
import { RealtimeModule } from '../../realtime/realtime.module'
import { GameModule } from '../game/game.module'
import { LobbyService } from './lobby.service'
import { SocketGateway } from '../../socket/socket.gateway'
import { RateLimiter } from '../../socket/rate-limiter'
import { HostAuthThrottle } from '../../socket/host-auth-throttle'
import { HeartbeatMonitor } from '../../socket/heartbeat-monitor'
import { WS_ALLOWED_ORIGINS } from '../../socket/socket.origin'
import { RoomsController } from './room.controller'
import { config } from '../../../config/server'

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
