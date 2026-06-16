/**
 * @file host-auth-throttle.test.ts
 * @owner server-squad
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { HostAuthThrottle } from '../../src/server/socket/host-auth-throttle'
import { HOST_AUTH } from '../../src/shared/constants/game-config.constants'

function clockThrottle(): { throttle: HostAuthThrottle; advance(ms: number): void } {
  let now = 1_000
  const throttle = new HostAuthThrottle(() => now)
  return { throttle, advance: (ms: number): void => void (now += ms) }
}

describe('HostAuthThrottle', () => {
  it('does not lock out below the failure cap', () => {
    const { throttle } = clockThrottle()
    for (let i = 0; i < HOST_AUTH.MAX_FAILURES - 1; i++) {
      throttle.recordFailure('1.2.3.4')
    }
    assert.equal(throttle.isLockedOut('1.2.3.4'), false)
  })

  it('locks out once the failure cap is hit', () => {
    const { throttle } = clockThrottle()
    for (let i = 0; i < HOST_AUTH.MAX_FAILURES; i++) {
      throttle.recordFailure('1.2.3.4')
    }
    assert.equal(throttle.isLockedOut('1.2.3.4'), true)
  })

  it('lockout expires after LOCKOUT_MS', () => {
    const { throttle, advance } = clockThrottle()
    for (let i = 0; i < HOST_AUTH.MAX_FAILURES; i++) {
      throttle.recordFailure('1.2.3.4')
    }
    advance(HOST_AUTH.LOCKOUT_MS + 1)
    assert.equal(throttle.isLockedOut('1.2.3.4'), false)
  })

  it('a success clears prior failures', () => {
    const { throttle } = clockThrottle()
    for (let i = 0; i < HOST_AUTH.MAX_FAILURES - 1; i++) {
      throttle.recordFailure('1.2.3.4')
    }
    throttle.recordSuccess('1.2.3.4')
    throttle.recordFailure('1.2.3.4')
    assert.equal(throttle.isLockedOut('1.2.3.4'), false)
  })

  it('tracks IPs independently', () => {
    const { throttle } = clockThrottle()
    for (let i = 0; i < HOST_AUTH.MAX_FAILURES; i++) {
      throttle.recordFailure('1.1.1.1')
    }
    assert.equal(throttle.isLockedOut('1.1.1.1'), true)
    assert.equal(throttle.isLockedOut('2.2.2.2'), false)
  })

  it('never locks out an empty IP', () => {
    const { throttle } = clockThrottle()
    for (let i = 0; i < HOST_AUTH.MAX_FAILURES * 2; i++) {
      throttle.recordFailure('')
    }
    assert.equal(throttle.isLockedOut(''), false)
  })
})
