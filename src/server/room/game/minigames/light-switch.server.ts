import { Injectable } from '@nestjs/common'
import {
  createLightSwitchPuzzle,
  applySwitch
} from '../../../../minigames/light-switch/LightSwitchGame'
import type {
  LightSwitchPuzzle,
  LightSwitch
} from '../../../../minigames/light-switch/LightSwitch.types'
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
      seed: input.seed
    })

    const scoringConfig: LightSwitchScoreConfig = {
      baseScore: BASE_SCORE,
      maxMoveBonus: MAX_MOVE_BONUS,
      timeLimitMs: input.timeLimitSeconds * MILLISECONDS_PER_SECOND
    }

    return {
      type: this.type,
      seed: input.seed,
      publicState: this.toRecord(puzzle),
      privateState: this.toRecord(puzzle),
      scoringConfig: this.toRecord(scoringConfig)
    }
  }

  public validateSubmission(submission: unknown): boolean {
    if (typeof submission !== 'object' || submission === null) {
      return false
    }

    const obj = submission as Record<string, unknown>

    const switches = obj['activeSwitches']

    if (!Array.isArray(switches)) {
      return false
    }

    if (switches.length === 0) {
      return false
    }

    return switches.every((v) => {
      if (typeof v !== 'number') {
        return false
      }

      if (!Number.isInteger(v)) {
        return false
      }

      if (v < 0) {
        return false
      }

      return true
    })
  }

  public scoreSubmission(
    submission: unknown,
    privateState: Record<string, unknown>,
    scoringConfig: Record<string, unknown>,
    timeToAnswerMs: number): MinigameScoreResult {
    if (
      typeof submission !== 'object' ||
      submission === null ||
      typeof privateState !== 'object' ||
      privateState === null ||
      typeof scoringConfig !== 'object' ||
      scoringConfig === null
    ) {
      return { isCorrect: false, pointsAwarded: 0 }
    }

    const { activeSwitches } = submission as Record<string, unknown>
    const state = privateState as Record<string, unknown>
    const config = scoringConfig as Record<string, unknown>

    if (!Array.isArray(activeSwitches)) {
      return { isCorrect: false, pointsAwarded: 0 }
    }

    const switches = state['switches'] as LightSwitch[] | undefined
    const initialLights = state['lights'] as any

    if (!Array.isArray(switches) || !Array.isArray(initialLights)) {
      return { isCorrect: false, pointsAwarded: 0 }
    }

    let lights = initialLights.map((l: any) => l.isOn)

    for (const swIndex of activeSwitches) {
      const sw = switches[swIndex]

      if (!sw) {
        continue
      }

      lights = applySwitch(lights, sw)
    }

    const isCorrect = lights.every((v) => v === true)

    const baseScore = (config['baseScore'] as number) ?? 1000
    const maxMoveBonus = (config['maxMoveBonus'] as number) ?? 500
    const timeLimitMs = (config['timeLimitMs'] as number) ?? 0

    const movePenalty = Math.min(activeSwitches.length * 10, maxMoveBonus)

    let timeBonus = 0

    if (timeLimitMs > 0) {
      const remaining = Math.max(timeLimitMs - timeToAnswerMs, 0)
      timeBonus = Math.floor((remaining / timeLimitMs) * maxMoveBonus)
    }

    const pointsAwarded = isCorrect
      ? baseScore + timeBonus - movePenalty
      : 0

    return {
      isCorrect,
      pointsAwarded: Math.max(pointsAwarded, 0),
    }
  }

  private toRecord(value: LightSwitchPuzzle | LightSwitchScoreConfig): Record<string, unknown> {
    return { ...value }
  }
}
