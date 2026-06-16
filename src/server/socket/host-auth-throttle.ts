/**
 * @file host-auth-throttle.ts
 * @owner server-squad
 * @description Brute-force guard for host-token authentication. Counts failed
 * host-token attempts per client IP within a sliding window; once an IP hits
 * HOST_AUTH.MAX_FAILURES it is locked out for HOST_AUTH.LOCKOUT_MS. A success
 * clears the IP's record. The gateway consults this before/after attempting a
 * host connection so the small 4-char join-code + token space can't be
 * enumerated at speed.
 */
import 'reflect-metadata'
import { Injectable } from '@nestjs/common'
import { HOST_AUTH } from '@config/game.config'
import { HostAuthRecord } from './socket.types'

@Injectable()
export class HostAuthThrottle {
  private readonly _records = new Map<string, HostAuthRecord>()

  /** Clock seam so tests can advance time deterministically. */
  public constructor(private readonly now: () => number = Date.now) {}

  /** True when this IP is currently locked out (too many recent failures). */
  public isLockedOut(ip: string): boolean {
    if (!ip) {
      return false
    }
    const record = this._records.get(ip)
    return record !== undefined && record.lockedUntil > this.now()
  }

  /** Record a failed host-token attempt; locks the IP out once over the cap. */
  public recordFailure(ip: string): void {
    if (!ip) {
      return
    }
    const now = this.now()
    const existing = this._records.get(ip)
    if (!existing || now - existing.firstFailureAt >= HOST_AUTH.WINDOW_MS) {
      this._records.set(ip, { failures: 1, firstFailureAt: now, lockedUntil: 0 })
      return
    }
    existing.failures += 1
    if (existing.failures >= HOST_AUTH.MAX_FAILURES) {
      existing.lockedUntil = now + HOST_AUTH.LOCKOUT_MS
    }
  }

  /** Clear an IP's record after a successful host authentication. */
  public recordSuccess(ip: string): void {
    if (ip) {
      this._records.delete(ip)
    }
  }
}
