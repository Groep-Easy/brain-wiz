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
import { APP_GUARD } from '@nestjs/core'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'

import { HTTP_THROTTLE } from '@brain-wiz/config/game.config'
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
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: HTTP_THROTTLE.DEFAULT_TTL_MS,
        limit: HTTP_THROTTLE.DEFAULT_LIMIT,
      },
    ]),
    DatabaseModule,
    LobbyModule,
    SocketModule,
    HealthModule,
    QuestionModule,
    FlowModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
