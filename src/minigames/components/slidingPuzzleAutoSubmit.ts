import { isSolved, type SlidingPuzzleBoard } from '../sliding-puzzle/shared/slidingPuzzleGame'

export type SlidingPuzzleRoundPhase = 'playing' | 'reveal'

export interface SlidingPuzzleSubmission {
  board: SlidingPuzzleBoard
}

export interface SlidingPuzzleBoardUpdateInput {
  board: SlidingPuzzleBoard
  submitted: boolean
  phase: SlidingPuzzleRoundPhase
  onProgress: ((submission: SlidingPuzzleSubmission) => void) | undefined
  onSubmit: (submission: SlidingPuzzleSubmission) => void
}

export function shouldAutoSubmitSlidingPuzzleBoard(
  board: SlidingPuzzleBoard,
  submitted: boolean,
  phase: SlidingPuzzleRoundPhase
): boolean {
  return !submitted && phase === 'playing' && isSolved(board)
}

export function handleSlidingPuzzleBoardUpdate({
  board,
  submitted,
  phase,
  onProgress,
  onSubmit,
}: SlidingPuzzleBoardUpdateInput): void {
  if (submitted || phase !== 'playing') {
    return
  }

  onProgress?.({ board })
  if (shouldAutoSubmitSlidingPuzzleBoard(board, submitted, phase)) {
    onSubmit({ board })
  }
}
