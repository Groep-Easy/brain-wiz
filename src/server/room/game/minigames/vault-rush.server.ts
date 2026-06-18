import { Injectable } from '@nestjs/common'
import { createVaultRushRound } from '@brain-wiz/minigames/vault-rush/shared/vaultRushGame'
import type { RoundType } from '../../../../shared/types/index.js'
import type {
  CreateMinigameRoundInput,
  GeneratedMinigameRound,
  MinigameAdapter,
  MinigameScoreResult,
  VaultRushPrivateState,
  VaultRushScoringConfig,
} from './minigame.types.js'

const BASE_POINTS = 700
const SOLVE_SPEED_BONUS = 300
const MILLISECONDS_PER_SECOND = 1000
const VAULT_CODE_PATTERN = /^\d{4}$/

@Injectable()
export class VaultRushServerAdapter implements MinigameAdapter {
  public readonly type = 'vault-rush'

  public accepts(type: RoundType): type is 'vault-rush' {
    return type === this.type
  }

  public createRound(input: CreateMinigameRoundInput): GeneratedMinigameRound {
    const generated = createVaultRushRound({
      id: input.roundId,
      seed: input.seed,
    })

    const privateState: VaultRushPrivateState = {
      code: generated.code,
    }

    const scoringConfig: VaultRushScoringConfig = {
      basePoints: BASE_POINTS,
      solveSpeedBonus: SOLVE_SPEED_BONUS,
      timeLimitMs: input.timeLimitSeconds * MILLISECONDS_PER_SECOND,
    }

    return {
      type: this.type,
      seed: input.seed,
      publicState: generated.puzzle,
      privateState,
      scoringConfig,
    }
  }

  public validateSubmission(submission: unknown): boolean {
    return this.parseCode(submission) !== undefined
  }

  public scoreSubmission(
    submission: unknown,
    privateState: Record<string, unknown>,
    scoringConfig: Record<string, unknown>,
    timeToAnswerMs: number
  ): MinigameScoreResult {
    const code = this.parseCode(submission)
    const parsedPrivate = this.parsePrivateState(privateState)
    const config = this.parseConfig(scoringConfig)

    if (!code || !parsedPrivate || !config) {
      return { isCorrect: false, pointsAwarded: 0 }
    }

    const isCorrect = code === parsedPrivate.code
    const speedBonus = isCorrect ? this.speedBonus(config, timeToAnswerMs) : 0
    const pointsAwarded = isCorrect ? config.basePoints + speedBonus : 0

    return {
      isCorrect,
      pointsAwarded,
      breakdown: {
        submittedCode: code,
        basePoints: isCorrect ? config.basePoints : 0,
        speedBonus,
      },
      publicSolution: {
        code: parsedPrivate.code,
      },
    }
  }

  private parseCode(submission: unknown): string | undefined {
    if (!this.isRecord(submission)) {
      return undefined
    }

    const code = submission['code']

    if (typeof code !== 'string') {
      return undefined
    }

    const trimmedCode = code.trim()

    return VAULT_CODE_PATTERN.test(trimmedCode) ? trimmedCode : undefined
  }

  private parsePrivateState(
    privateState: Record<string, unknown>
  ): VaultRushPrivateState | undefined {
    const code = privateState['code']

    if (typeof code !== 'string' || !VAULT_CODE_PATTERN.test(code)) {
      return undefined
    }

    return { code }
  }

  private parseConfig(config: Record<string, unknown>): VaultRushScoringConfig | undefined {
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

    return {
      basePoints,
      solveSpeedBonus,
      timeLimitMs,
    }
  }

  private speedBonus(config: VaultRushScoringConfig, timeToAnswerMs: number): number {
    const remaining = config.timeLimitMs - timeToAnswerMs
    const clamped = Math.max(0, Math.min(config.timeLimitMs, remaining))
    return Math.round(config.solveSpeedBonus * (clamped / config.timeLimitMs))
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }
}
