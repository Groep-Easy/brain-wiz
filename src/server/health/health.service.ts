/**
 * @file health.service.ts
 * @owner server-squad
 * @description Produces the server health snapshot. Fully implemented — used by
 * load balancers / uptime checks to confirm the process is alive.
 */
import { Injectable } from '@nestjs/common'

export interface HealthStatus {
  status: 'ok'
  uptimeSeconds: number
  timestamp: string
}

@Injectable()
export class HealthService {
  /**
   * Return a fresh health snapshot for the running process.
   */
  public check(): HealthStatus {
    return {
      status: 'ok',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    }
  }
}
