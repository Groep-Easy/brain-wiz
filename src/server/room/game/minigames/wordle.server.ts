import { Injectable } from '@nestjs/common'
import {
  evaluate_guess,
  get_random_word,
  get_game_state,
  is_valid_word,
} from '@brain-wiz/minigames/wordleGame/shared/wordleGame'
import { MAX_TRIES, WORD_LENGTH } from '@brain-wiz/minigames/wordleGame/shared/wordleGame.constants'
import type {
  Guess,
  WordleFeedback,
  WordlePublicState,
  WordleSubmission,
} from '@brain-wiz/minigames/wordleGame/shared/wordleGame.types'
import type {
  CreateMinigameRoundInput,
  GeneratedMinigameRound,
  MinigameAdapter,
  MinigameScoreResult,
  WordlePrivateState,
  WordleScoringConfig,
} from './minigame.types.js'
import type { RoundType } from '@brain-wiz/shared/types/index'

const BASE_POINTS = 1000
const POINTS_PER_EXTRA_GUESS = 100
const SOLVE_SPEED_BONUS = 300
const MILLISECONDS_PER_SECOND = 1000

@Injectable()
export class WordleServerAdapter implements MinigameAdapter {
  public readonly type = 'wordle' as const

  public accepts(type: RoundType): type is 'wordle' {
    return type === this.type
  }

  public createRound(
    input: CreateMinigameRoundInput
  ): GeneratedMinigameRound<WordlePublicState, WordlePrivateState, WordleScoringConfig> {
    const answer = get_random_word()
    const privateState: WordlePrivateState = { answer }
    const scoringConfig: WordleScoringConfig = {
      basePoints: BASE_POINTS,
      pointsPerExtraGuess: POINTS_PER_EXTRA_GUESS,
      solveSpeedBonus: SOLVE_SPEED_BONUS,
      timeLimitMs: input.timeLimitSeconds * MILLISECONDS_PER_SECOND,
    }

    return {
      type: this.type,
      seed: input.seed,
      publicState: { wordLength: WORD_LENGTH, maxTries: MAX_TRIES },
      privateState,
      scoringConfig,
    }
  }

  public validateSubmission(submission: unknown): boolean {
    return this.parseSubmission(submission) !== undefined
  }

  public getProgressFeedback(
    submission: unknown,
    privateState: Record<string, unknown>
  ): WordleFeedback | undefined {
    const parsed = this.parseSubmission(submission)
    const parsedPrivate = this.parsePrivateState(privateState)

    if (!parsed || !parsedPrivate) {
      return undefined
    }

    const guesses = this.evaluateGuesses(parsed.guesses, parsedPrivate.answer)
    return {
      guesses,
      phase: get_game_state(guesses, parsedPrivate.answer),
    }
  }

  public scoreSubmission(
    submission: unknown,
    privateState: Record<string, unknown>,
    scoringConfig: Record<string, unknown>,
    timeToAnswerMs: number
  ): MinigameScoreResult {
    const parsed = this.parseSubmission(submission)
    const parsedPrivate = this.parsePrivateState(privateState)
    const config = this.parseConfig(scoringConfig)

    if (!parsed || !parsedPrivate || !config) {
      return { isCorrect: false, pointsAwarded: 0 }
    }

    const { guesses } = parsed
    const evaluatedGuesses = this.evaluateGuesses(guesses, parsedPrivate.answer)
    const phase = get_game_state(evaluatedGuesses, parsedPrivate.answer)
    const isCorrect = phase === 'solved'

    if (!isCorrect) {
      return {
        isCorrect: false,
        pointsAwarded: 0,
        breakdown: { guessCount: guesses.length },
        publicSolution: { answer: parsedPrivate.answer },
      }
    }

    const guessCount = guesses.length
    const guessDeduction = (guessCount - 1) * config.pointsPerExtraGuess
    const timeBonus = this.speedBonus(config, timeToAnswerMs)
    const pointsAwarded = Math.max(0, config.basePoints - guessDeduction + timeBonus)

    return {
      isCorrect: true,
      pointsAwarded,
      breakdown: { guessCount, guessDeduction, timeBonus },
      publicSolution: { answer: parsedPrivate.answer },
    }
  }

  private parseSubmission(submission: unknown): WordleSubmission | undefined {
    if (!this.isRecord(submission)) return undefined

    const guesses = submission['guesses']
    if (!Array.isArray(guesses)) return undefined
    if (guesses.length === 0 || guesses.length > MAX_TRIES) return undefined

    const normalizedGuesses = guesses.map((guess) => this.parseGuessWord(guess))

    if (normalizedGuesses.some((guess) => guess === undefined)) return undefined

    return { guesses: normalizedGuesses as string[] }
  }

  private parseGuessWord(guess: unknown): string | undefined {
    if (typeof guess !== 'string') {
      return undefined
    }

    const normalized = guess.trim().toUpperCase()
    if (normalized.length !== WORD_LENGTH || !is_valid_word(normalized)) {
      return undefined
    }

    return normalized
  }

  private parsePrivateState(privateState: Record<string, unknown>): WordlePrivateState | undefined {
    const answer = privateState['answer']
    if (typeof answer !== 'string') {
      return undefined
    }

    const normalized = answer.trim().toUpperCase()
    if (normalized.length !== WORD_LENGTH || !is_valid_word(normalized)) {
      return undefined
    }

    return { answer: normalized }
  }

  private parseConfig(config: Record<string, unknown>): WordleScoringConfig | undefined {
    const basePoints = config['basePoints']
    const pointsPerExtraGuess = config['pointsPerExtraGuess']
    const solveSpeedBonus = config['solveSpeedBonus']
    const timeLimitMs = config['timeLimitMs']

    if (
      typeof basePoints !== 'number' ||
      typeof pointsPerExtraGuess !== 'number' ||
      typeof solveSpeedBonus !== 'number' ||
      typeof timeLimitMs !== 'number'
    ) {
      return undefined
    }

    return { basePoints, pointsPerExtraGuess, solveSpeedBonus, timeLimitMs }
  }

  private evaluateGuesses(guesses: string[], answer: string): Guess[] {
    return guesses.map((guess) => evaluate_guess(guess, answer))
  }

  private speedBonus(config: WordleScoringConfig, timeToAnswerMs: number): number {
    const remaining = config.timeLimitMs - timeToAnswerMs
    const clamped = Math.max(0, Math.min(config.timeLimitMs, remaining))
    return Math.round(config.solveSpeedBonus * (clamped / config.timeLimitMs))
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }
}
