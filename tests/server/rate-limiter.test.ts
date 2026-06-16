/**
 * @file rate-limiter.test.ts
 * @owner server-squad
 * @description Unit tests for the per-connection inbound rate limiter. Uses an
 * injected clock so the sliding window can be advanced deterministically.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { RateLimiter } from '../../src/server/socket/rate-limiter'
import { RATE_LIMIT } from '../../src/shared/constants/game-config.constants'

function clockLimiter(): { limiter: RateLimiter; advance(ms: number): void } {
  let now = 1_000
  const limiter = new RateLimiter(() => now)
  return { limiter, advance: (ms: number): void => void (now += ms) }
}

describe('RateLimiter', () => {
  it('allows messages up to the cap within one window', () => {
    const { limiter } = clockLimiter()
    for (let i = 0; i < RATE_LIMIT.MAX_MESSAGES; i++) {
      assert.equal(limiter.allow('c1'), true)
    }
  })

  it('drops the message that exceeds the cap', () => {
    const { limiter } = clockLimiter()
    for (let i = 0; i < RATE_LIMIT.MAX_MESSAGES; i++) {
      limiter.allow('c1')
    }
    assert.equal(limiter.allow('c1'), false)
  })

  it('refills after the window elapses', () => {
    const { limiter, advance } = clockLimiter()
    for (let i = 0; i < RATE_LIMIT.MAX_MESSAGES; i++) {
      limiter.allow('c1')
    }
    assert.equal(limiter.allow('c1'), false)
    advance(RATE_LIMIT.WINDOW_MS)
    assert.equal(limiter.allow('c1'), true)
  })

  it('tracks each connection independently', () => {
    const { limiter } = clockLimiter()
    for (let i = 0; i < RATE_LIMIT.MAX_MESSAGES; i++) {
      limiter.allow('c1')
    }
    assert.equal(limiter.allow('c1'), false)
    assert.equal(limiter.allow('c2'), true)
  })

  it('never rate limits an empty key (no connection id)', () => {
    const { limiter } = clockLimiter()
    for (let i = 0; i < RATE_LIMIT.MAX_MESSAGES * 2; i++) {
      assert.equal(limiter.allow(undefined), true)
    }
  })

  it('reset clears a connection window', () => {
    const { limiter } = clockLimiter()
    for (let i = 0; i < RATE_LIMIT.MAX_MESSAGES; i++) {
      limiter.allow('c1')
    }
    assert.equal(limiter.allow('c1'), false)
    limiter.reset('c1')
    assert.equal(limiter.allow('c1'), true)
  })
})
