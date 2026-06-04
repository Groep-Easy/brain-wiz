/**
 * @file phase-timer.ts
 * @owner server-squad
 * @description A single cancellable phase countdown. Emits one tick per second
 * via `onTick(secondsRemaining)` and resolves with a TimerOutcome. Always
 * clears its interval on resolution, so no tick fires after it settles.
 */
import { TimerOutcome, type PhaseTimerLike, type TimerOptions } from './game.types'

const ONE_SECOND_MS = 1000

export class PhaseTimer implements PhaseTimerLike {
  private interval: ReturnType<typeof setInterval> | null = null
  private resolveFn: ((outcome: TimerOutcome) => void) | null = null

  public async start(seconds: number, opts: TimerOptions): Promise<TimerOutcome> {
    this.clear()
    let remaining = seconds
    return new Promise<TimerOutcome>((resolve) => {
      this.resolveFn = resolve
      this.interval = setInterval(() => {
        remaining -= 1
        opts.onTick(remaining)
        if (remaining <= 0) {
          this.settle(TimerOutcome.EXPIRED)
        }
      }, ONE_SECOND_MS)
      // Never let a pending timer keep the process alive.
      this.interval.unref?.()
    })
  }

  public endEarly(): void {
    this.settle(TimerOutcome.ENDED_EARLY)
  }

  public cancel(): void {
    this.settle(TimerOutcome.ABORTED)
  }

  private settle(outcome: TimerOutcome): void {
    const resolve = this.resolveFn
    if (!resolve) {
      return
    }
    this.clear()
    resolve(outcome)
  }

  private clear(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    this.resolveFn = null
  }
}
