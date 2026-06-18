import type { RoundAnswerChoice, RoundType } from '@brain-wiz/shared/types/index'

export type ProceduralRoundType = 'sliding-puzzle' | 'balance-scale'

export interface CreateMinigameRoundInput {
  roundId: string
  seed: string
  roundIndex: number
  timeLimitSeconds: number
}

export interface GeneratedMinigameRound<TPublic = unknown, TPrivate = unknown, TConfig = unknown> {
  type: ProceduralRoundType
  seed: string
  publicState: TPublic
  privateState: TPrivate
  scoringConfig: TConfig
}

export interface MinigameScoreResult {
  isCorrect: boolean
  pointsAwarded: number
  breakdown?: unknown
  publicSolution?: unknown
}

export interface MinigameAdapter {
  readonly type: ProceduralRoundType
  createRound(input: CreateMinigameRoundInput): GeneratedMinigameRound
  accepts(type: RoundType): type is ProceduralRoundType
  getAnswerChoices?(publicState: Record<string, unknown>): RoundAnswerChoice[]
  validateSubmission(submission: unknown): boolean
  scoreSubmission(
    submission: unknown,
    privateState: Record<string, unknown>,
    scoringConfig: Record<string, unknown>,
    timeToAnswerMs: number
  ): MinigameScoreResult
}

export interface BalanceScalePrivateState {
  correctOptionId: string
}

export interface BalanceScaleScoringConfig {
  basePoints: number
  solveSpeedBonus: number
  timeLimitMs: number
}
