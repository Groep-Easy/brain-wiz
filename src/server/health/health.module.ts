/**
 * @file health.module.ts
 * @owner server-squad
 * @description Health feature module. Exposes the `GET /health` endpoint.
 */
import { Module } from '@nestjs/common'
import { HealthController } from './health.controller.js'
import { HealthService } from './health.service.js'

@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
