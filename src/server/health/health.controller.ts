/**
 * @file health.controller.ts
 * @owner server-squad
 * @description HTTP health endpoint. Fully implemented — `GET /health` returns
 * the current process health snapshot.
 */
import { Controller, Get } from '@nestjs/common'
import { HealthService, type HealthStatus } from './health.service'

@Controller('health')
export class HealthController {
  public constructor(private readonly healthService: HealthService) {}

  @Get()
  public getHealth(): HealthStatus {
    return this.healthService.check()
  }
}
