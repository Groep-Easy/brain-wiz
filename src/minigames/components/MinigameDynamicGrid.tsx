import { useState } from 'react'
import { SlidingPuzzle } from '../sliding-puzzle/components/SlidingPuzzle'
import type {
  SlidingPuzzleBoard,
  SlidingPuzzlePuzzle
} from '../sliding-puzzle/shared/slidingPuzzleGame'

export interface MinigameDynamicGridProps {
  type: string
  puzzle: any
  state: any
  stateChange: Function
  submit: Function
  submitted: boolean | undefined
  phase: string
}

export function MinigameDynamicGrid({
    type,
    puzzle,
    state,
    stateChange,
    submit,
    submitted,
    phase
}: MinigameDynamicGridProps): React.JSX.Element {
  switch (type) {
    case 'sliding-puzzle':
      puzzle = puzzle as SlidingPuzzlePuzzle
      return (
        <section className="client-minigame client-minigame--sliding">
          <SlidingPuzzle puzzle={puzzle} onBoardChange={stateChange} />
          <div className="client-minigame__actions">
            <button
            className="primary-btn"
            disabled={submitted || phase === 'reveal'}
              onClick={() => submit({ board: state ?? puzzle.initialBoard })}
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

export function minigameInitialize(
  type: string,
  startState: any,
  stateChange: Function
): any {
  switch (type) {
    case 'sliding-puzzle':
      stateChange((startState as SlidingPuzzlePuzzle).initialBoard)
      return

    default:
      return
  }
}
