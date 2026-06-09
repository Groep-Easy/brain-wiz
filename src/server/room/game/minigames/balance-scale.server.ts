import { Injectable } from '@nestjs/common'
import {
  EASY_SCALE_DIFFICULTY,
  HARD_SCALE_DIFFICULTY,
  generateScalePuzzle,
  toPublicScalePuzzle,
  type ScaleDifficulty,
  type ScalePuzzle,
} from '../../../../minigames/balance-scale/shared/scaleGame.js'
import { getDefaultScaleItemPool } from '../../../../minigames/balance-scale/shared/scaleGame.presets.js'
import { hashSeed } from '../../../../shared/utils/seeded-random.js'
import type { RoundAnswerChoice, RoundType } from '../../../../shared/types/index.js'
import type {
  CreateMinigameRoundInput,
  GeneratedMinigameRound,
  MinigameAdapter,
  MinigameScoreResult,
} from './minigame.types.js'

const BASE_POINTS = 700
const SOLVE_SPEED_BONUS = 300
const MILLISECONDS_PER_SECOND = 1000
const EASY_SCALE_ROUND_COUNT = 2

interface BalanceScalePrivateState {
  correctOptionId: string
}

interface BalanceScaleScoringConfig {
  basePoints: number
  solveSpeedBonus: number
  timeLimitMs: number
}

@Injectable()
export class BalanceScaleServerAdapter implements MinigameAdapter {
  public readonly type = 'balance-scale'

  public accepts(type: RoundType): type is 'balance-scale' {
    return type === this.type
  }

  public createRound(input: CreateMinigameRoundInput): GeneratedMinigameRound {
    const difficulty = this.difficultyForRound(input.roundIndex)
    const itemPool = getDefaultScaleItemPool(hashSeed(input.seed), difficulty)
    const puzzle = generateScalePuzzle({
      id: input.roundId,
      seed: input.seed,
      difficulty,
      itemPool,
    })

    if (!puzzle.correctOptionId) {
      throw new Error(`Balance-scale round ${input.roundId} generated without a correct option`)
    }

    const privateState: BalanceScalePrivateState = { correctOptionId: puzzle.correctOptionId }
    const scoringConfig: BalanceScaleScoringConfig = {
      basePoints: BASE_POINTS,
      solveSpeedBonus: SOLVE_SPEED_BONUS,
      timeLimitMs: input.timeLimitSeconds * MILLISECONDS_PER_SECOND,
    }

    return {
      type: this.type,
      seed: input.seed,
      publicState: this.toRecord(toPublicScalePuzzle(puzzle)),
      privateState: this.toRecord(privateState),
      scoringConfig: this.toRecord(scoringConfig),
    }
  }

  public validateSubmission(submission: unknown): boolean {
    return this.parseOptionId(submission) !== undefined
  }

  public getAnswerChoices(publicState: Record<string, unknown>): RoundAnswerChoice[] {
    const options = publicState['options']
    if (!Array.isArray(options)) {
      return []
    }

    return options.flatMap((option) => {
      if (!this.isRecord(option)) {
        return []
      }
      const id = option['id']
      const label = option['label']
      const emoji = option['emoji']
      if (typeof id !== 'string' || typeof label !== 'string') {
        return []
      }
      return [
        {
          id,
          label,
          ...(typeof emoji === 'string' ? { emoji } : {}),
          submission: { optionId: id },
        },
      ]
    })
  }

  public scoreSubmission(
    submission: unknown,
    privateState: Record<string, unknown>,
    scoringConfig: Record<string, unknown>,
    timeToAnswerMs: number
  ): MinigameScoreResult {
    const optionId = this.parseOptionId(submission)
    const parsedPrivate = this.parsePrivateState(privateState)
    const config = this.parseConfig(scoringConfig)
    if (!optionId || !parsedPrivate || !config) {
      return { isCorrect: false, pointsAwarded: 0 }
    }

    const isCorrect = optionId === parsedPrivate.correctOptionId
    const speedBonus = isCorrect ? this.speedBonus(config, timeToAnswerMs) : 0
    const pointsAwarded = isCorrect ? config.basePoints + speedBonus : 0

    return {
      isCorrect,
      pointsAwarded,
      breakdown: {
        selectedOptionId: optionId,
        basePoints: isCorrect ? config.basePoints : 0,
        speedBonus,
      },
      publicSolution: { correctOptionId: parsedPrivate.correctOptionId },
    }
  }

  private difficultyForRound(roundIndex: number): ScaleDifficulty {
    return roundIndex < EASY_SCALE_ROUND_COUNT ? EASY_SCALE_DIFFICULTY : HARD_SCALE_DIFFICULTY
  }

  private parseOptionId(submission: unknown): string | undefined {
    if (!this.isRecord(submission)) {
      return undefined
    }
    const optionId = submission['optionId']
    return typeof optionId === 'string' && optionId.trim().length > 0 ? optionId : undefined
  }

  private parsePrivateState(
    privateState: Record<string, unknown>
  ): BalanceScalePrivateState | undefined {
    const correctOptionId = privateState['correctOptionId']
    if (typeof correctOptionId !== 'string') {
      return undefined
    }
    return { correctOptionId }
  }

  private parseConfig(config: Record<string, unknown>): BalanceScaleScoringConfig | undefined {
    const basePoints = config['basePoints']
    const solveSpeedBonus = config['solveSpeedBonus']
    const timeLimitMs = config['timeLimitMs']
    if (
      typeof basePoints !== 'number' ||
      typeof solveSpeedBonus !== 'number' ||
      typeof timeLimitMs !== 'number'
    ) {
      return undefined
    }
    return { basePoints, solveSpeedBonus, timeLimitMs }
  }

  private speedBonus(config: BalanceScaleScoringConfig, timeToAnswerMs: number): number {
    const remaining = config.timeLimitMs - timeToAnswerMs
    const clamped = Math.max(0, Math.min(config.timeLimitMs, remaining))
    return Math.round(config.solveSpeedBonus * (clamped / config.timeLimitMs))
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }

  private toRecord(
    value: ScalePuzzle | BalanceScalePrivateState | BalanceScaleScoringConfig
  ): Record<string, unknown> {
    return value as unknown as Record<string, unknown>
  }
}
