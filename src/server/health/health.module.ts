/**
 * @file health.module.ts
 * @owner server-squad
 * @description Health feature module. Exposes the `GET /health` endpoint.
 */
import { Module } from '@nestjs/common'
import { HealthController } from './health.controller'
import { HealthService } from './health.service'

@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
