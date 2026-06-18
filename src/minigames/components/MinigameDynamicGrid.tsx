import { useState } from 'react'
import { SlidingPuzzle } from '../sliding-puzzle/components/SlidingPuzzle'
import type {
  SlidingPuzzleBoard,
  SlidingPuzzlePuzzle
} from '../sliding-puzzle/shared/slidingPuzzleGame'
import {WordleMock} from '../wordleGame/mock/WordleGameMock'
import type { Guess } from '../wordleGame/shared/wordleGame.types'

export type MinigameDynamicGridProps = {
  type: 'sliding-puzzle'
  puzzle: unknown
  onSubmit: (submission: { board: SlidingPuzzleBoard }) => void
  submitted: boolean
  phase: 'playing'|'reveal'
} | {
  type: 'wordle'
  answer: string
  onSubmit: (submission: { guesses: Guess[] }) => void
  submitted: boolean
  phase: 'playing' | 'reveal'
}
 | {
  type: 'example'
}

// Element needs to be called in client App.tsx under renderMinigame on a game by game basis
export function MinigameDynamicGrid(data: MinigameDynamicGridProps): React.JSX.Element | null {
  // React hooks
  const [slidingBoard, setSlidingBoard] = useState<SlidingPuzzleBoard | null>(null)

  // Type guards
  function isSlidingPuzzlePuzzle(value: unknown): value is SlidingPuzzlePuzzle {
    const testValue = value as SlidingPuzzlePuzzle
    return (
      typeof testValue.id === 'string' &&
      typeof testValue.image.id === 'string' &&
      typeof testValue.image.url === 'string' &&
      typeof testValue.image.alt === 'string' &&
      Array.isArray(testValue.initialBoard) &&
      testValue.initialBoard.every((tile) => typeof tile === 'number' && Number.isInteger(tile))
    )
  }

  // Minigame rendering
  const type = data.type

  switch (type) {
    case 'sliding-puzzle': {
      if (!isSlidingPuzzlePuzzle(data.puzzle)) {
        return null
      }
      const puzzle = data.puzzle
      const submitted = data.submitted
      const phase = data.phase

      return (
        <section className="client-minigame client-minigame--sliding">
          <SlidingPuzzle puzzle={puzzle} onBoardChange={setSlidingBoard} />
          <div className="client-minigame__actions">
            <button
              className="primary-btn"
              disabled={submitted || phase === 'reveal'}
              onClick={() => data.onSubmit({ board: slidingBoard ?? puzzle.initialBoard })}
              type="button"
            >
              Submit board
            </button>
          </div>
        </section>
      )
    }

    case 'wordle': {
      return (
        <section className="client-minigame client-minigame--wordle">
          <WordleMock
            answer={data.answer}
            onSubmit={data.onSubmit}
            submitted={data.submitted}

          />
        </section>
      )
    }

    case 'example':
      return <section></section>

    default:
      return null
  }
}
