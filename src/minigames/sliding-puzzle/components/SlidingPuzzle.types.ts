import type { SlidingPuzzleBoard, SlidingPuzzlePuzzle } from '../shared/slidingPuzzleGame.js'

export interface SlidingPuzzleProps {
  puzzle: SlidingPuzzlePuzzle
  showLocalControls?: boolean
  readOnly?: boolean
  onBoardChange?: (board: SlidingPuzzleBoard) => void
}
