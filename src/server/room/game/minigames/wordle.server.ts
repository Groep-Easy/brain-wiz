import { Injectable } from '@nestjs/common'
import {
  get_random_word,
  get_game_state,
  getAmountGuesses,
} from '@brain-wiz/minigames/wordleGame/shared/wordleGame'
import type { Guess } from '@brain-wiz/minigames/wordleGame/shared/wordleGame.types'
import type {
  CreateMinigameRoundInput,
  GeneratedMinigameRound,
  MinigameAdapter,
  MinigameScoreResult,
} from './minigame.types.js'
import type { RoundType } from '@brain-wiz/shared/types/index'

const BASE_POINTS = 1000
const POINTS_PER_EXTRA_GUESS = 100
const SOLVE_SPEED_BONUS = 300
const MILLISECONDS_PER_SECOND = 1000
const AMOUNT_SECONDS = 60

@Injectable()
export class WordleServerAdapter implements MinigameAdapter {
  public readonly type = 'wordle' as const

  public accepts(type: RoundType): type is 'wordle' {
    return type === this.type
  }

  public createRound(input: CreateMinigameRoundInput): GeneratedMinigameRound {
    const answer = get_random_word()

    return {
      type: this.type,
      seed: input.seed,
      publicState: { answer },
      privateState: { answer },
      scoringConfig: {
        basePoints: BASE_POINTS,
        pointsPerExtraGuess: POINTS_PER_EXTRA_GUESS,
        solveSpeedBonus: SOLVE_SPEED_BONUS,
        timeLimitMs: input.timeLimitSeconds * MILLISECONDS_PER_SECOND,
      },
    }
  }

  public validateSubmission(submission: unknown): boolean {
    return this.parseSubmission(submission) !== undefined
  }

  public scoreSubmission(
    submission: unknown,
    privateState: Record<string, unknown>,
    scoringConfig: Record<string, unknown>,
    timeToAnswerMs: number
  ): MinigameScoreResult {
    const parsed = this.parseSubmission(submission)
    const answer = privateState['answer']

    if (!parsed || typeof answer !== 'string') {
      return { isCorrect: false, pointsAwarded: 0 }
    }

    const { guesses } = parsed
    const phase = get_game_state(guesses, answer)
    const isCorrect = phase === 'solved'

    if (!isCorrect) {
      return { isCorrect: false, pointsAwarded: 0, publicSolution: { answer } }
    }

    const guessCount = getAmountGuesses(guesses)
    const basePoints =
      typeof scoringConfig['basePoints'] === 'number' ? scoringConfig['basePoints'] : BASE_POINTS
    const pointsPerExtraGuess =
      typeof scoringConfig['pointsPerExtraGuess'] === 'number'
        ? scoringConfig['pointsPerExtraGuess']
        : POINTS_PER_EXTRA_GUESS
    const solveSpeedBonus =
      typeof scoringConfig['solveSpeedBonus'] === 'number'
        ? scoringConfig['solveSpeedBonus']
        : SOLVE_SPEED_BONUS
    const timeLimitMs =
      typeof scoringConfig['timeLimitMs'] === 'number'
        ? scoringConfig['timeLimitMs']
        : AMOUNT_SECONDS * MILLISECONDS_PER_SECOND

    // fewer guesses = more points
    const guessDeduction = (guessCount - 1) * pointsPerExtraGuess
    // faster = more bonus
    const timeBonus = Math.floor((1 - timeToAnswerMs / timeLimitMs) * solveSpeedBonus)
    const pointsAwarded = Math.max(0, basePoints - guessDeduction + timeBonus)

    return {
      isCorrect: true,
      pointsAwarded,
      breakdown: { guessCount, guessDeduction, timeBonus },
      publicSolution: { answer },
    }
  }

  private parseSubmission(submission: unknown): { guesses: Guess[] } | undefined {
    if (!this.isRecord(submission)) return undefined

    const guesses = submission['guesses']
    if (!Array.isArray(guesses)) return undefined

    // validate each guess has a word array of tiles
    const isValid = guesses.every(
      (g) =>
        this.isRecord(g) &&
        Array.isArray(g['word']) &&
        g['word'].every(
          (tile) =>
            this.isRecord(tile) &&
            typeof tile['letter'] === 'string' &&
            typeof tile['state'] === 'string'
        )
    )

    if (!isValid) return undefined

    return { guesses: guesses as Guess[] }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }
}
