import { Injectable } from '@nestjs/common'
import {
  CONFIG,
  scoreBonkAirSolution,
  type BonkAirPuzzle,
  type BonkAirScoreConfig,
  type BonkAirSolution,
  type PlanePath,
} from '@brain-wiz/minigames/bonk-air/shared/bonkAirGame'
import type {
  CreateMinigameRoundInput,
  GeneratedMinigameRound,
  MinigameAdapter,
  MinigameScoreResult,
} from './minigame.types.js'
import type { RoundType } from '@brain-wiz/shared/types/index'

// Bonk Air is locked to easy mode (Trainee) for now.
const EASY_DIFFICULTY = 1
const MILLISECONDS_PER_SECOND = 1000

@Injectable()
export class BonkAirServerAdapter implements MinigameAdapter {
  public readonly type = 'bonk-air'

  public accepts(type: RoundType): type is 'bonk-air' {
    return type === this.type
  }

  public createRound(input: CreateMinigameRoundInput): GeneratedMinigameRound {
    const publicState: BonkAirPuzzle = { seed: input.seed, diff: EASY_DIFFICULTY }
    const scoringConfig: BonkAirScoreConfig = {
      timeLimitMs: input.timeLimitSeconds * MILLISECONDS_PER_SECOND,
      earlyMax: CONFIG.EARLY_MAX,
    }

    return {
      type: this.type,
      seed: input.seed,
      publicState: { ...publicState },
      // The world is recomputable from seed + diff; keep them server-side for scoring.
      privateState: { ...publicState },
      scoringConfig: { ...scoringConfig },
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
    const solution = this.parseSubmission(submission)
    const puzzle = this.parsePuzzle(privateState)
    const config = this.parseConfig(scoringConfig)
    if (!solution || !puzzle || !config) {
      return { isCorrect: false, pointsAwarded: 0 }
    }

    const result = scoreBonkAirSolution(puzzle, solution, config, timeToAnswerMs)
    const isCorrect = result.results.violations === 0 && result.results.per.every((r) => r.base > 0)
    return {
      isCorrect,
      pointsAwarded: Math.max(0, Math.round(result.score)),
      breakdown: result,
    }
  }

  /** The seed + difficulty stored in privateState fully determine the world. */
  private parsePuzzle(privateState: Record<string, unknown>): BonkAirPuzzle | undefined {
    const seed = privateState['seed']
    const diff = privateState['diff']
    if (typeof seed !== 'string' || typeof diff !== 'number') {
      return undefined
    }
    return { seed, diff }
  }

  private parseConfig(config: Record<string, unknown>): BonkAirScoreConfig | undefined {
    const timeLimitMs = config['timeLimitMs']
    const earlyMax = config['earlyMax']
    if (typeof timeLimitMs !== 'number' || typeof earlyMax !== 'number') {
      return undefined
    }
    return { timeLimitMs, earlyMax }
  }

  private parseSubmission(submission: unknown): BonkAirSolution | undefined {
    if (!this.isRecord(submission)) {
      return undefined
    }
    const solution = submission['solution']
    if (!this.isRecord(solution)) {
      return undefined
    }
    const parsed: BonkAirSolution = {}
    for (const [key, value] of Object.entries(solution)) {
      const id = Number(key)
      if (!Number.isInteger(id) || id < 0) {
        return undefined
      }
      const path = this.parsePath(value)
      if (!path) {
        return undefined
      }
      parsed[id] = path
    }
    return parsed
  }

  private parsePath(value: unknown): PlanePath | undefined {
    if (!this.isRecord(value)) {
      return undefined
    }
    const cells = value['cells']
    const complete = value['complete']
    if (!Array.isArray(cells) || typeof complete !== 'boolean') {
      return undefined
    }
    const parsedCells = []
    for (const cell of cells) {
      if (!this.isRecord(cell)) {
        return undefined
      }
      const x = cell['x']
      const y = cell['y']
      if (
        typeof x !== 'number' ||
        typeof y !== 'number' ||
        !Number.isFinite(x) ||
        !Number.isFinite(y)
      ) {
        return undefined
      }
      parsedCells.push({ x, y })
    }
    return { cells: parsedCells, complete }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }
}
