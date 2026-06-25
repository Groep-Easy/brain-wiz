import type { BonkAirPuzzle } from '../shared/bonkAirGame.js'

/** Build a deterministic sample puzzle for the local dev harness. */
export function getSampleBonkAirPuzzle(index: number, diff = 2): BonkAirPuzzle {
  return { seed: `mock-bonk-air-${index}`, diff }
}
