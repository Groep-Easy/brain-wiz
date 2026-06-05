/**
 * @file rate-limiter.ts
 * @owner server-squad
 * @description Per-connection inbound-message rate limiter. A fixed-window
 * counter keyed by connection id: each connection may send at most
 * RATE_LIMIT.MAX_MESSAGES within any RATE_LIMIT.WINDOW_MS window. The gateway
 * calls `allow()` at the top of every message handler and drops the message
 * when it returns false, blunting flood/DoS attempts from a single socket.
 */
import 'reflect-metadata'
import { Injectable } from '@nestjs/common'
import { RATE_LIMIT } from '../../shared/constants/game-config'
import type { RateLimitWindow } from './socket.types'

@Injectable()
export class RateLimiter {
  private readonly _windows = new Map<string, RateLimitWindow>()

  /** Clock seam so tests can advance time deterministically. */
  public constructor(private readonly now: () => number = Date.now) {}

  /**
   * Record a message for `key` and report whether it is within budget.
   * Returns false (drop the message) once the per-window cap is exceeded.
   * An empty key is never rate limited — it means we have no connection id.
   */
  public allow(key: string | undefined): boolean {
    if (!key) {
      return true
    }
    const now = this.now()
    const existing = this._windows.get(key)
    if (!existing || now - existing.windowStart >= RATE_LIMIT.WINDOW_MS) {
      this._windows.set(key, { windowStart: now, count: 1 })
      return true
    }
    existing.count += 1
    return existing.count <= RATE_LIMIT.MAX_MESSAGES
  }

  /** Forget a connection's window. Called on disconnect to avoid leaks. */
  public reset(key: string | undefined): void {
    if (key) {
      this._windows.delete(key)
    }
  }
}
