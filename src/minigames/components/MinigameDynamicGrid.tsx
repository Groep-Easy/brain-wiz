import { SlidingPuzzle } from '../sliding-puzzle/components/SlidingPuzzle'
import type {
  SlidingPuzzleBoard,
  SlidingPuzzlePuzzle,
} from '../sliding-puzzle/shared/slidingPuzzleGame'
import { VaultRush } from '@brain-wiz/minigames/vault-rush/components/VaultRush'
import type { VaultRushPuzzle } from '@brain-wiz/minigames/vault-rush/shared/vaultRushGame'
import {
  handleSlidingPuzzleBoardUpdate,
  type SlidingPuzzleRoundPhase,
} from './slidingPuzzleAutoSubmit'
import { WordleMock } from '../wordleGame/mock/WordleGameMock'
import type { Guess } from '../wordleGame/shared/wordleGame.types'

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
      type: 'vault-rush'
      puzzle: unknown
      onSubmit: (submission: { code: string }) => void
      submitted: boolean
      phase: SlidingPuzzleRoundPhase
      solutionCode?: string | undefined
      secondsRemaining?: number
    }
  | {
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

  function isVaultRushPuzzle(value: unknown): value is VaultRushPuzzle {
    const testValue = value as VaultRushPuzzle
    return (
      typeof testValue.id === 'string' &&
      Array.isArray(testValue.clues) &&
      testValue.clues.every(
        (clue) => typeof clue.digitIndex === 'number' && typeof clue.text === 'string'
      )
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

    case 'vault-rush': {
      if (!isVaultRushPuzzle(data.puzzle)) {
        return null
      }

      const puzzle = data.puzzle
      const submitted = data.submitted
      const phase = data.phase

      const vaultRushProps = {
        onSubmitCode: (code: string) => {
          data.onSubmit({ code })
        },
        puzzle,
        readOnly: submitted || phase === 'reveal',
        submitted,
        ...(phase === 'playing' && data.secondsRemaining !== undefined
          ? { secondsRemaining: data.secondsRemaining }
          : {}),
        ...(phase === 'reveal' && data.solutionCode ? { solutionCode: data.solutionCode } : {}),
      }

      return (
        <section className="client-minigame client-minigame--vault-rush">
          <VaultRush {...vaultRushProps} />
        </section>
      )
    }

    case 'wordle': {
      return (
        <section className="client-minigame client-minigame--wordle">
          <WordleMock answer={data.answer} onSubmit={data.onSubmit} submitted={data.submitted} />
        </section>
      )
    }

    case 'example':
      return <section></section>

    default:
      return null
  }
}
