/**
 * @file health.controller.ts
 * @owner server-squad
 * @description HTTP health endpoint. Fully implemented — `GET /health` returns
 * the current process health snapshot.
 */
import { Controller, Get } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { HealthService, type HealthStatus } from './health.service'
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger'

@SkipThrottle()
@Controller('health')
export class HealthController {
  public constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'Health check',
    description: 'Returns the current system health status snapshot',
  })
  @ApiOkResponse({
    description: 'System health status',
    schema: {
      example: {
        status: 'ok',
        uptime: 12345,
        timestamp: '2026-06-10T12:00:00.000Z',
      },
    },
  })
  public getHealth(): HealthStatus {
    return this.healthService.check()
  }
}
