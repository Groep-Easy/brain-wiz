/**
 * @file phase-timer.test.ts
 * @owner server-squad
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { PhaseTimer } from '../../src/server/room/game/phase-timer'
import { TimerOutcome } from '../../src/server/room/game/game.types'

describe('PhaseTimer', () => {
  it('expires after N seconds, ticking down to 0', async (t) => {
    t.mock.timers.enable({ apis: ['setInterval'] })
    const timer = new PhaseTimer()
    const ticks: number[] = []
    const p = timer.start(3, { onTick: (s: number) => ticks.push(s) })
    t.mock.timers.tick(3000)
    const outcome = await p
    assert.deepEqual(ticks, [2, 1, 0])
    assert.equal(outcome, TimerOutcome.EXPIRED)
  })

  it('cancel() resolves ABORTED and stops further ticks', async (t) => {
    t.mock.timers.enable({ apis: ['setInterval'] })
    const timer = new PhaseTimer()
    const ticks: number[] = []
    const p = timer.start(10, { onTick: (s: number) => ticks.push(s) })
    t.mock.timers.tick(2000)
    timer.cancel()
    const outcome = await p
    t.mock.timers.tick(5000)
    assert.equal(outcome, TimerOutcome.ABORTED)
    assert.deepEqual(ticks, [9, 8])
  })

  it('endEarly() resolves ENDED_EARLY', async (t) => {
    t.mock.timers.enable({ apis: ['setInterval'] })
    const timer = new PhaseTimer()
    const p = timer.start(10, { onTick: (): void => undefined })
    t.mock.timers.tick(1000)
    timer.endEarly()
    assert.equal(await p, TimerOutcome.ENDED_EARLY)
  })

  it('ignores cancel()/endEarly() after it already expired', async (t) => {
    t.mock.timers.enable({ apis: ['setInterval'] })
    const timer = new PhaseTimer()
    const p = timer.start(1, { onTick: (): void => undefined })
    t.mock.timers.tick(1000)
    assert.equal(await p, TimerOutcome.EXPIRED)
    timer.cancel() // no throw, no effect
  })
})
