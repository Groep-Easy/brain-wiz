/**
 * @file app.module.ts
 * @description Root application module. Wires together the feature modules and
 * top-level HTTP controllers. Keep wiring here — no business logic.
 *
 * Module initialization order matters:
 * 1. DatabaseModule - must initialize first to set up connections
 * 2. Feature modules - use DatabaseModule for repositories
 */
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { DatabaseModule } from './database/index'
import { LobbyModule } from './room/lobby/lobby.module'
import { SocketModule } from './socket/index'
import { HealthModule } from './health/health.module'
import { QuestionModule } from './question/question.module'
import { FlowModule } from './flow/flow.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    LobbyModule,
    SocketModule,
    HealthModule,
    QuestionModule,
    FlowModule,
  ],
})
export class AppModule {}
