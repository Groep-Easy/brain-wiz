/**
 * @file app.module.ts
 * @owner server-squad
 * @description Root application module. Wires together the feature modules and
 * top-level HTTP controllers. Keep wiring here — no business logic.
 */
import { Module } from '@nestjs/common'
import { SocketModule } from './socket/socket.module.js'
import { HealthModule } from './health/health.module.js'
import { RoomsController } from './rooms/rooms.controller.js'

@Module({
  imports: [SocketModule, HealthModule],
  controllers: [RoomsController],
})
export class AppModule {}
