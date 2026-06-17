import type { SlidingPuzzleBoard, SlidingPuzzlePuzzle } from '@brain-wiz/shared/slidingPuzzleGame'

export interface SlidingPuzzleProps {
  puzzle: SlidingPuzzlePuzzle
  showLocalControls?: boolean
  readOnly?: boolean
  onBoardChange?: (board: SlidingPuzzleBoard) => void
}
