import { Injectable } from '@nestjs/common'
import {
  createLightSwitchPuzzle,
  applySwitch,
} from '@brain-wiz/minigames/light-switch/LightSwitchGame'
import type {
  LightSwitchPuzzle,
  LightSwitch,
} from '@brain-wiz/minigames/light-switch/LightSwitch.types'
import type {
  CreateMinigameRoundInput,
  GeneratedMinigameRound,
  MinigameAdapter,
  MinigameScoreResult,
  LightSwitchScoreConfig,
} from './minigame.types.js'
import type { RoundType } from '@brain-wiz/shared/types/index'

const BASE_SCORE = 1000
const MAX_MOVE_BONUS = 500
const MILLISECONDS_PER_SECOND = 1000

@Injectable()
export class LightSwitchServerAdapter implements MinigameAdapter {
  public readonly type = 'light-switch'

  public accepts(type: RoundType): type is 'light-switch' {
    return type === this.type
  }

  public createRound(input: CreateMinigameRoundInput): GeneratedMinigameRound {
    const puzzle = createLightSwitchPuzzle({
      id: input.roundId,
      seed: input.seed,
    })

    const scoringConfig: LightSwitchScoreConfig = {
      baseScore: BASE_SCORE,
      maxMoveBonus: MAX_MOVE_BONUS,
      timeLimitMs: input.timeLimitSeconds * MILLISECONDS_PER_SECOND,
    }

    return {
      type: this.type,
      seed: input.seed,
      publicState: this.toRecord(puzzle),
      privateState: this.toRecord(puzzle),
      scoringConfig: this.toRecord(scoringConfig),
    }
  }

  public validateSubmission(submission: unknown): boolean {
    if (!Array.isArray(submission)) {
      return false
    }

    if (submission.length === 0) {
      return false
    }

    return submission.every((v) => {
      return typeof v === 'number' && Number.isInteger(v) && v >= 0
    })
  }

  public scoreSubmission(
    submission: unknown,
    privateState: Record<string, unknown>,
    scoringConfig: Record<string, unknown>,
    timeToAnswerMs: number
  ): MinigameScoreResult {
    if (
      !Array.isArray(submission) ||
      submission === null ||
      typeof privateState !== 'object' ||
      privateState === null ||
      typeof scoringConfig !== 'object' ||
      scoringConfig === null
    ) {
      return { isCorrect: false, pointsAwarded: 0 }
    }

    const puzzle = this.parsePrivateState(privateState)
    const isSolved = this.checkSubmission(submission, puzzle as LightSwitchPuzzle)

    const timeLimitMs = this.parseConfig(scoringConfig) as number
    const clampedRemaining = Math.max(0, Math.min(timeLimitMs, timeLimitMs - timeToAnswerMs))
    const rawScore = isSolved ? Math.round(BASE_SCORE * (clampedRemaining / timeLimitMs)) : 0
    return {
      isCorrect: isSolved,
      pointsAwarded: rawScore,
    }
  }

  private checkSubmission(submission: number[], puzzle: LightSwitchPuzzle): boolean {
    let state = puzzle.lights.map((l) => l.isOn)

    for (const switchIndex of submission) {
      const sw = puzzle.switches[switchIndex]

      if (!sw) continue

      state = applySwitch(state, sw)
    }

    return state.every((isOn) => isOn === true)
  }

  private parsePrivateState(state: Record<string, unknown>): LightSwitchPuzzle | null {
    const lights = state['lights']
    const switches = state['switches']

    if (!Array.isArray(lights) || !Array.isArray(switches)) {
      return null
    }

    return {
      id: typeof state['id'] === 'string' ? state['id'] : '',
      lights: lights as LightSwitchPuzzle['lights'],
      switches: switches as LightSwitch[],
    }
  }

  private parseConfig(config: Record<string, unknown>): number | undefined {
    const timeLimitMs = config['timeLimitMs']
    if (typeof timeLimitMs !== 'number') {
      return undefined
    }
    return timeLimitMs
  }

  private toRecord(value: LightSwitchPuzzle | LightSwitchScoreConfig): Record<string, unknown> {
    return { ...value }
  }
}
