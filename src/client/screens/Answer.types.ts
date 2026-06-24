import type { PlayerAnswerResult, QuestionState } from '@brain-wiz/shared/types/index'

export type AnswerOption = QuestionState['answers'][number]

export interface AnswerProps {
  question: QuestionState
  selectedAnswerId: string | null
  phase: 'playing' | 'reveal'
  result: PlayerAnswerResult | null
  correctAnswerIds: string[]
  secondsRemaining: number
  onAnswer: (answerId: string) => void
}

export interface AnswerStatusProps {
  revealed: boolean
  result: PlayerAnswerResult | null
  selectedAnswerId: string | null
  secondsRemaining: number
  timeLimit: number
}

export interface AnswerTileProps {
  answer: AnswerOption
  index: number
  selectedAnswerId: string | null
  correctAnswerIds: string[]
  revealed: boolean
  locked: boolean
  onAnswer: (answerId: string) => void
}

export interface RevealBannerProps {
  result: PlayerAnswerResult | null
}
