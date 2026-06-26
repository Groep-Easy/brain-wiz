import type { BonkAirPuzzle, BonkAirSubmission } from '../shared/bonkAirGame.js'

export interface BonkAirProps {
  /** Public puzzle definition (seed + difficulty); the world is recomputed from it. */
  puzzle: BonkAirPuzzle
  /** Display-only mode (host screen): renders the sector map without input. */
  readOnly?: boolean
  /** Round phase: 'playing' lets the player route aircraft; 'reveal' plays the watch sim. */
  phase?: 'playing' | 'reveal'
  /** Fired whenever the player's plan changes, with the latest submission. */
  onSubmissionChange?: (submission: BonkAirSubmission) => void
  /** Fired once when the plan is locked in (TAKE OFF pressed or planning time runs out). */
  onCommit?: (submission: BonkAirSubmission) => void
  /** Fired once when the reveal replay (flight animation) has finished playing. */
  onReplayComplete?: () => void
}
