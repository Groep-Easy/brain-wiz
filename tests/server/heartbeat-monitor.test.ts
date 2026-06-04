/**
 * @file heartbeat-monitor.test.ts
 * @owner server-squad
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { HeartbeatMonitor } from '../../src/server/socket/heartbeat-monitor'
import type { HeartbeatSocket } from '../../src/server/socket/socket.types'

interface FakeWs {
  isAlive?: boolean
  pings: number
  terminated: boolean
  pongListener?: () => void
  ping(): void
  terminate(): void
  on(event: string, listener: () => void): void
}

function fakeWs(): FakeWs {
  const s: FakeWs = {
    pings: 0,
    terminated: false,
    ping(): void {
      s.pings += 1
    },
    terminate(): void {
      s.terminated = true
    },
    on(event: string, listener: () => void): void {
      if (event === 'pong') {
        s.pongListener = listener
      }
    },
  }
  return s
}

describe('HeartbeatMonitor', () => {
  it('pings a tracked socket on the first sweep', () => {
    const monitor = new HeartbeatMonitor()
    const ws = fakeWs()
    monitor.track(ws)
    monitor.reap()
    assert.equal(ws.pings, 1)
    assert.equal(ws.terminated, false)
  })

  it('terminates a socket that never ponged before the next sweep', () => {
    const monitor = new HeartbeatMonitor()
    const ws = fakeWs()
    monitor.track(ws)
    monitor.reap() // marks not-alive, pings
    monitor.reap() // no pong arrived → terminate
    assert.equal(ws.terminated, true)
  })

  it('keeps a socket that ponged between sweeps', () => {
    const monitor = new HeartbeatMonitor()
    const ws = fakeWs()
    monitor.track(ws)
    monitor.reap()
    ws.pongListener?.() // pong arrives
    monitor.reap()
    assert.equal(ws.terminated, false)
    assert.equal(ws.pings, 2)
  })

  it('stops pinging an untracked socket', () => {
    const monitor = new HeartbeatMonitor()
    const ws = fakeWs()
    monitor.track(ws)
    monitor.untrack(ws)
    monitor.reap()
    assert.equal(ws.pings, 0)
  })

  it('ignores sockets without the ws ping/pong API', () => {
    const monitor = new HeartbeatMonitor()
    const plain = { send: (): void => undefined } as unknown as HeartbeatSocket
    assert.doesNotThrow(() => monitor.track(plain))
    assert.doesNotThrow(() => monitor.reap())
  })
})
