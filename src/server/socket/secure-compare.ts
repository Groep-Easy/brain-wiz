/**
 * @file secure-compare.ts
 * @owner server-squad
 * @description Constant-time string comparison for secrets (host/reconnect
 * tokens). Avoids the early-exit timing signal of `a === b`. Differing lengths
 * short-circuit (the length of a fixed-size UUID token isn't sensitive).
 */
import { timingSafeEqual } from 'node:crypto'

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) {
    return false
  }
  return timingSafeEqual(ab, bb)
}
