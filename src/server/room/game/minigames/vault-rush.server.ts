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

// Points the player gets for solving the vault correctly
const BASE_POINTS = 700

// Extra points based on how fast the player answers
const SOLVE_SPEED_BONUS = 300

// Used to convert seconds to milliseconds
const MILLISECONDS_PER_SECOND = 1000

// A valid vault code must be exactly 4 digits
const VAULT_CODE_PATTERN = /^\d{4}$/

@Injectable()
export class VaultRushServerAdapter implements MinigameAdapter {
  // This tells the minigame system that this adapter belongs to Vault Rush
  public readonly type = 'vault-rush'

  // Checks if this adapter should handle this round type
  public accepts(type: RoundType): type is 'vault-rush' {
    return type === this.type
  }

  public createRound(input: CreateMinigameRoundInput): GeneratedMinigameRound {
    // Generate the vault puzzle using the round id and seed
    // This creates both the visible puzzle and the hidden correct code
    const generated = createVaultRushRound({
      id: input.roundId,
      seed: input.seed,
    })

    // Store the real answer on the server only
    // This should not be sent to the client during the round
    const privateState: VaultRushPrivateState = {
      code: generated.code,
    }

    // Store the scoring rules for this round
    const scoringConfig: VaultRushScoringConfig = {
      basePoints: BASE_POINTS,
      solveSpeedBonus: SOLVE_SPEED_BONUS,
      timeLimitMs: input.timeLimitSeconds * MILLISECONDS_PER_SECOND,
    }

    return {
      type: this.type,
      seed: input.seed,

      // This is safe to send to the client
      // It contains the clues/puzzle, but not the real code
      publicState: generated.puzzle,

      // This stays on the server
      // It contains the real code
      privateState,

      // This is used later when calculating points
      scoringConfig,
    }
  }

  public validateSubmission(submission: unknown): boolean {
    // Check if the submitted answer has the correct format
    return this.parseCode(submission) !== undefined
  }

  public scoreSubmission(
    submission: unknown,
    privateState: Record<string, unknown>,
    scoringConfig: Record<string, unknown>,
    timeToAnswerMs: number
  ): MinigameScoreResult {
    // Read the code that the player submitted
    const code = this.parseCode(submission)

    // Read the hidden correct code from the server state
    const parsedPrivate = this.parsePrivateState(privateState)

    // Read the scoring settings for this round
    const config = this.parseConfig(scoringConfig)

    // If something is missing or invalid, give 0 points
    if (!code || !parsedPrivate || !config) {
      return { isCorrect: false, pointsAwarded: 0 }
    }

    // Compare the player's submitted code with the real server-side code
    const isCorrect = code === parsedPrivate.code

    // Only give a speed bonus if the submitted code is correct
    const speedBonus = isCorrect ? this.speedBonus(config, timeToAnswerMs) : 0

    // Correct answer gets base points + speed bonus
    // Wrong answer gets 0 points
    const pointsAwarded = isCorrect ? config.basePoints + speedBonus : 0

    return {
      isCorrect,
      pointsAwarded,
      breakdown: {
        submittedCode: code,
        basePoints: isCorrect ? config.basePoints : 0,
        speedBonus,
      },

      // This can be shown after the round is finished
      // It reveals the correct code only after scoring
      publicSolution: {
        code: parsedPrivate.code,
      },
    }
  }

  private parseCode(submission: unknown): string | undefined {
    // Make sure the submission is an object
    if (!this.isRecord(submission)) {
      return undefined
    }

    // Get the code field from the submitted object
    const code = submission['code']

    // The code must be a string
    if (typeof code !== 'string') {
      return undefined
    }

    // Remove spaces around the code
    const trimmedCode = code.trim()

    // Return the code only if it is exactly 4 digits
    return VAULT_CODE_PATTERN.test(trimmedCode) ? trimmedCode : undefined
  }

  private parsePrivateState(
    privateState: Record<string, unknown>
  ): VaultRushPrivateState | undefined {
    // Get the hidden correct code from privateState
    const code = privateState['code']

    // Make sure the hidden code exists and has the correct format
    if (typeof code !== 'string' || !VAULT_CODE_PATTERN.test(code)) {
      return undefined
    }

    return { code }
  }

  private parseConfig(config: Record<string, unknown>): VaultRushScoringConfig | undefined {
    // Read scoring values from the config object
    const basePoints = config['basePoints']
    const solveSpeedBonus = config['solveSpeedBonus']
    const timeLimitMs = config['timeLimitMs']

    // All scoring values must be numbers
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
    // Calculate how much time was left when the player answered
    const remaining = config.timeLimitMs - timeToAnswerMs

    // Keep the remaining time between 0 and the full time limit
    const clamped = Math.max(0, Math.min(config.timeLimitMs, remaining))

    // More remaining time means more bonus points
    return Math.round(config.solveSpeedBonus * (clamped / config.timeLimitMs))
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    // Check if a value is a normal object
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }
}
