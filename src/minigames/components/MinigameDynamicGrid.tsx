import { useState } from 'react'
import { SlidingPuzzle } from '../sliding-puzzle/components/SlidingPuzzle'
import type {
  SlidingPuzzleBoard,
  SlidingPuzzlePuzzle
} from '../sliding-puzzle/shared/slidingPuzzleGame'

export interface MinigameDynamicGridProps {
  init: boolean
  type: string
  puzzle: any
  submit: Function | null
  submitted: boolean | undefined
  phase: string
}

export function MinigameDynamicGrid({
    init,
    type,
    puzzle,
    submit,
    submitted,
    phase
}: MinigameDynamicGridProps): React.JSX.Element | null {
  const [slidingBoard, setSlidingBoard] = useState<SlidingPuzzleBoard | null>(null)

  if (init) {
    switch (type) {
      case 'sliding-puzzle':
        setSlidingBoard((puzzle as SlidingPuzzlePuzzle).initialBoard)
        return null

      default:
        return null
    }
  }

  switch (type) {
    case 'sliding-puzzle':
      puzzle = puzzle as SlidingPuzzlePuzzle
      return (
        <section className="client-minigame client-minigame--sliding">
          <SlidingPuzzle puzzle={puzzle} onBoardChange={setSlidingBoard} />
          <div className="client-minigame__actions">
            <button
            className="primary-btn"
            disabled={submitted || phase === 'reveal'}
              onClick={() => submit({ board: slidingBoard ?? puzzle.initialBoard })}
              type="button"
            >
              Submit board
            </button>
          </div>
        </section>
      )

      default:
        return (
          <section></section>
        )
  }
}
