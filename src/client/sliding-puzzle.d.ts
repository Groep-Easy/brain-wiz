/**
 * @file sliding-puzzle.d.ts
 * @owner client-squad
 * @description Types for the standalone sliding-puzzle bundle
 * (assets/sliding-puzzle/sliding-puzzle.js). Loaded as a classic <script>, it
 * reads React + ReactDOM off `window` and registers itself on
 * `window.BrainWizSlidingPuzzle`.
 */
interface SlidingPuzzleRoot {
  unmount: () => void
}

interface BrainWizSlidingPuzzle {
  mountSlidingPuzzleGame: (target: Element, options?: Record<string, unknown>) => SlidingPuzzleRoot
}

interface Window {
  React?: unknown
  ReactDOM?: unknown
  BrainWizSlidingPuzzle?: BrainWizSlidingPuzzle
}
