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
import { DatabaseModule } from './database/index.js'
import { LobbyModule } from './room/lobby/lobby.module.js'
import { HealthModule } from './health/health.module.js'

@Module({
  imports: [DatabaseModule, LobbyModule, HealthModule],
})
export class AppModule {}
