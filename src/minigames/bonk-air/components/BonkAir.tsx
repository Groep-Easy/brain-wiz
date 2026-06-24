import { useEffect, useRef, type JSX } from 'react'
import { createBonkAirRuntime, type BonkAirRuntime } from './BonkAir.runtime.js'
import type { BonkAirProps } from './BonkAir.types.js'
import './BonkAir.css'

/**
 * Bonk Air ("Sector Control") minigame. Renders the flight-deck shell and hands
 * the canvas + HUD to the imperative runtime, which owns rendering, input, and
 * the deterministic watch simulation. The world is recomputed from `puzzle` so
 * every player sees the same airspace; scoring is server-authoritative.
 */
export function BonkAir({ puzzle, readOnly = false, phase = 'playing', onSubmissionChange, onCommit, onReplayComplete }: BonkAirProps): JSX.Element {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const runtimeRef = useRef<BonkAirRuntime | null>(null)
  const onSubmissionChangeRef = useRef(onSubmissionChange)
  onSubmissionChangeRef.current = onSubmissionChange
  const onCommitRef = useRef(onCommit)
  onCommitRef.current = onCommit
  const onReplayCompleteRef = useRef(onReplayComplete)
  onReplayCompleteRef.current = onReplayComplete

  // (Re)build the runtime when the puzzle (seed/difficulty) or mode changes.
  useEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current
    if (!root || !canvas) return undefined
    const runtime = createBonkAirRuntime({
      root,
      canvas,
      puzzle,
      readOnly,
      onSubmissionChange: (submission) => onSubmissionChangeRef.current?.(submission),
      onCommit: (submission) => onCommitRef.current?.(submission),
      onReplayComplete: () => onReplayCompleteRef.current?.(),
    })
    runtimeRef.current = runtime
    return () => {
      runtime.destroy()
      runtimeRef.current = null
    }
  }, [puzzle.seed, puzzle.diff, readOnly])

  // Drive the watch simulation when the round enters its reveal phase.
  useEffect(() => {
    runtimeRef.current?.setPhase(phase)
  }, [phase])

  return (
    <div className="bonk-air-root" ref={rootRef}>
      <div className="ba-stage">
        <canvas className="ba-game" ref={canvasRef} />
        <div className="ba-topbar" hidden>
          <div className="ba-rightchips">
            <div className="chip ba-timer">0:30</div>
          </div>
        </div>
        <div className="ba-botbar" hidden>
          <button className="btn primary ba-lock" type="button">
            ✈ TAKE OFF
          </button>
        </div>
        <div className="ba-banner" hidden />
        <div className="ba-toast" />
      </div>
      <div className="ba-rotate" hidden>
        <span>📱</span>Rotate your phone to landscape
      </div>
    </div>
  )
}
