import { Injectable } from '@nestjs/common'
import {
  SOLVED_BOARD,
  createSlidingPuzzle,
  scoreSlidingPuzzleBoard,
  type SlidingPuzzleBoard,
  type SlidingPuzzlePuzzle,
  type SlidingPuzzleScoreConfig,
} from '@brain-wiz/minigames/sliding-puzzle/shared/slidingPuzzleGame'
import type {
  CreateMinigameRoundInput,
  GeneratedMinigameRound,
  MinigameAdapter,
  MinigameScoreResult,
} from './minigame.types.js'
import type { RoundType } from '@brain-wiz/shared/types/index'

const POINTS_PER_CORRECT_TILE = 100
const SOLVE_SPEED_BONUS = 300
const MILLISECONDS_PER_SECOND = 1000
const DEFAULT_IMAGE = Object.freeze({
  id: 'local-test-grid',
  url: '/client/minigames/local-test-puzzle.svg',
  alt: 'Numbered color grid puzzle',
})

@Injectable()
export class SlidingPuzzleServerAdapter implements MinigameAdapter {
  public readonly type = 'sliding-puzzle'

  public accepts(type: RoundType): type is 'sliding-puzzle' {
    return type === this.type
  }

  public createRound(input: CreateMinigameRoundInput): GeneratedMinigameRound {
    const puzzle = createSlidingPuzzle({
      id: input.roundId,
      image: DEFAULT_IMAGE,
      seed: input.seed,
    })
    const scoringConfig: SlidingPuzzleScoreConfig = {
      pointsPerCorrectTile: POINTS_PER_CORRECT_TILE,
      solveSpeedBonus: SOLVE_SPEED_BONUS,
      timeLimitMs: input.timeLimitSeconds * MILLISECONDS_PER_SECOND,
    }

    return {
      type: this.type,
      seed: input.seed,
      publicState: this.toRecord(puzzle),
      privateState: { solutionBoard: SOLVED_BOARD },
      scoringConfig: this.toRecord(scoringConfig),
    }
  }

  public validateSubmission(submission: unknown): boolean {
    return this.parseSubmission(submission) !== undefined
  }

  public scoreSubmission(
    submission: unknown,
    _privateState: Record<string, unknown>,
    scoringConfig: Record<string, unknown>,
    timeToAnswerMs: number
  ): MinigameScoreResult {
    const board = this.parseSubmission(submission)
    const config = this.parseConfig(scoringConfig)
    if (!board || !config) {
      return { isCorrect: false, pointsAwarded: 0 }
    }

    const breakdown = scoreSlidingPuzzleBoard(board, config, timeToAnswerMs)
    return {
      isCorrect: breakdown.solved,
      pointsAwarded: breakdown.pointsAwarded,
      breakdown,
      publicSolution: { board: SOLVED_BOARD },
    }
  }

  private parseSubmission(submission: unknown): SlidingPuzzleBoard | undefined {
    if (!this.isRecord(submission)) {
      return undefined
    }
    const board = submission['board']
    if (!this.isBoard(board)) {
      return undefined
    }
    return board
  }

  private parseConfig(config: Record<string, unknown>): SlidingPuzzleScoreConfig | undefined {
    const pointsPerCorrectTile = config['pointsPerCorrectTile']
    const solveSpeedBonus = config['solveSpeedBonus']
    const timeLimitMs = config['timeLimitMs']
    if (
      typeof pointsPerCorrectTile !== 'number' ||
      typeof solveSpeedBonus !== 'number' ||
      typeof timeLimitMs !== 'number'
    ) {
      return undefined
    }
    return { pointsPerCorrectTile, solveSpeedBonus, timeLimitMs }
  }

  private isBoard(value: unknown): value is SlidingPuzzleBoard {
    if (!Array.isArray(value) || value.length !== SOLVED_BOARD.length) {
      return false
    }
    if (!value.every((tile) => typeof tile === 'number' && Number.isInteger(tile))) {
      return false
    }
    const sorted = [...value].sort((first, second) => first - second)
    return sorted.every((tile, index) => tile === index)
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }

  private toRecord(value: SlidingPuzzlePuzzle | SlidingPuzzleScoreConfig): Record<string, unknown> {
    return { ...value }
  }
}
