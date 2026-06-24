import type { RoundAnswerChoice, RoundType } from '../../../../shared/types/index.js'

export type ProceduralRoundType = 'sliding-puzzle' | 'balance-scale' | 'bonk-air'

export interface CreateMinigameRoundInput {
  roundId: string
  seed: string
  roundIndex: number
  timeLimitSeconds: number
  /** Optional per-block difficulty (e.g. Bonk Air: 1=Trainee, 2=Certified, 3=Rush hour). */
  difficulty?: number
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
