import { SlidingPuzzle } from '../sliding-puzzle/components/SlidingPuzzle'
import type {
  SlidingPuzzleBoard,
  SlidingPuzzlePuzzle,
} from '../sliding-puzzle/shared/slidingPuzzleGame'
import {
  handleSlidingPuzzleBoardUpdate,
  type SlidingPuzzleRoundPhase,
} from './slidingPuzzleAutoSubmit'
import { WordleMock } from '../wordleGame/mock/WordleGameMock'
import type {
  WordleFeedback,
  WordlePublicState,
  WordleSubmission,
} from '../wordleGame/shared/wordleGame.types'

export type MinigameDynamicGridProps =
  | {
      type: 'sliding-puzzle'
      puzzle: unknown
      onSubmit: (submission: { board: SlidingPuzzleBoard }) => void
      onProgress?: (submission: { board: SlidingPuzzleBoard }) => void
      submitted: boolean
      phase: SlidingPuzzleRoundPhase
    }
  | {
      type: 'wordle'
      roundId: string
      publicState: WordlePublicState
      feedback?: WordleFeedback | null
      onGuess: (submission: WordleSubmission) => void
      onSubmit: (submission: WordleSubmission) => void
      submitted: boolean
      phase: 'playing' | 'reveal'
    }
  | {
      type: 'example'
    }

// Element needs to be called in client App.tsx under renderMinigame on a game by game basis
export function MinigameDynamicGrid(data: MinigameDynamicGridProps): React.JSX.Element | null {
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
      const handleBoardChange = (board: SlidingPuzzleBoard): void => {
        handleSlidingPuzzleBoardUpdate({
          board,
          submitted,
          phase,
          onProgress: data.onProgress,
          onSubmit: data.onSubmit,
        })
      }

      return (
        <section className="client-minigame client-minigame--sliding">
          <SlidingPuzzle
            onBoardChange={handleBoardChange}
            puzzle={puzzle}
            readOnly={submitted || phase === 'reveal'}
          />
        </section>
      )
    }

    case 'wordle': {
      return (
        <section className="client-minigame client-minigame--wordle">
          <WordleMock
            feedback={data.feedback}
            maxTries={data.publicState.maxTries}
            onGuess={data.onGuess}
            onSubmit={data.onSubmit}
            roundId={data.roundId}
            submitted={data.submitted || data.phase === 'reveal'}
            wordLength={data.publicState.wordLength}
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
