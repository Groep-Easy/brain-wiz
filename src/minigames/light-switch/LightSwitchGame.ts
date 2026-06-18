import {
  MIN_LIGHTS,
  MAX_LIGHTS,
  SWITCH_COUNT,
  MIN_AFFECTED_LIGHTS,
  MAX_AFFECTED_LIGHTS
} from './LightSwitch.constants.js'

import type {
  Light,
  LightSwitch,
  LightSwitchGenerationInput,
  LightSwitchPuzzle,
} from './LightSwitch.types.js'


function randomInt(random: () => number, min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min
}

export function applySwitch(state: boolean[], sw: LightSwitch): boolean[] {
  const next = [...state]

  for (const index of sw.affectedLights) {
    if (next[index] !== undefined) {
      next[index] = !next[index]
    }
  }

  return next
}

export function isSolved(state: boolean[]): boolean {
  return state.every((v) => v === true)
}

function createLights(
  lightCount: number,
  switches: LightSwitch[],
  random: () => number
): Light[] {
  const maxAttempts = 3

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let state: boolean[] = Array.from({ length: lightCount }, () => true)

    const scrambleMoves = lightCount + Math.floor(random() * lightCount)

    for (let i = 0; i < scrambleMoves; i++) {
      const sw = switches[Math.floor(random() * switches.length)]
      if (!sw) continue

      state = applySwitch(state, sw)
    }

    const solved = isSolved(state)

    if (!solved) {
      return state.map((isOn, id) => ({
        id,
        isOn,
      }))
    }
  }

  // If all attempts fail to produce a puzzle, return all lights off.
  return Array.from({ length: lightCount }, (_, id) => ({
    id,
    isOn: false,
  }))
}

function createSwitches(
  lightCount: number,
  random: () => number
): LightSwitch[] {
  return Array.from({ length: SWITCH_COUNT }, (_, index) => {
    const affectedCount = randomInt(
      random,
      MIN_AFFECTED_LIGHTS,
      MAX_AFFECTED_LIGHTS
    )

    const affectedLights = new Set<number>()

    while (affectedLights.size < affectedCount) {
      affectedLights.add(randomInt(random, 0, lightCount - 1))
    }

    return {
      id: index,
      affectedLights: [...affectedLights],
    }
  })
}

export function createLightSwitchPuzzle(
  input: LightSwitchGenerationInput
): LightSwitchPuzzle {
  const random = Math.random

  const lightCount = randomInt(random, MIN_LIGHTS, MAX_LIGHTS)
  const switches = createSwitches(lightCount, random)

  return {
    id: input.id,
    lights: createLights(lightCount, switches, random),
    switches: switches,
  }
}
