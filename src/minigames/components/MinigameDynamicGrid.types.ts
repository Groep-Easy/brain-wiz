import type { SlidingPuzzleBoard } from '../sliding-puzzle/shared/slidingPuzzleGame'
import type { SlidingPuzzleRoundPhase } from './slidingPuzzleAutoSubmit'
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

export type SlidingPuzzleData = Extract<MinigameDynamicGridProps, { type: 'sliding-puzzle' }>
export type VaultRushData = Extract<MinigameDynamicGridProps, { type: 'vault-rush' }>
export type WordleData = Extract<MinigameDynamicGridProps, { type: 'wordle' }>
