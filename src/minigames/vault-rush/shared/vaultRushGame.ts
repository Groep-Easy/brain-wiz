import { VAULT_RUSH_DIGIT_COUNT } from './vaultRushGame.constants.js'
import type {
  VaultRushClue,
  VaultRushGeneratedRound,
  VaultRushGenerationInput,
  VaultRushPuzzle,
} from './vaultRushGame.types.js'

export type { VaultRushClue, VaultRushGeneratedRound, VaultRushGenerationInput, VaultRushPuzzle }

const HASH_MULTIPLIER = 31
const HASH_INITIAL_VALUE = 2166136261
const RANDOM_DIVISOR = 4294967296

export function createVaultRushRound(input: VaultRushGenerationInput): VaultRushGeneratedRound {
  const random = createSeededRandom(input.seed)

  const digitOne = randomInt(random, 1, 4)
  const digitTwo = randomInt(random, 2, 9 - digitOne)
  const digitThree = digitOne + digitTwo
  const digitFour = 10 - digitThree

  const code = `${digitOne}${digitTwo}${digitThree}${digitFour}`

  const clues: VaultRushClue[] = [
    {
      digitIndex: 1,
      text: `Digit 1 = ${createSimpleEquation(digitOne, random)}`,
    },
    {
      digitIndex: 2,
      text: `Digit 2 = ${createSimpleEquation(digitTwo, random)}`,
    },
    {
      digitIndex: 3,
      text: 'Digit 3 = Digit 1 + Digit 2',
    },
    {
      digitIndex: 4,
      text: 'Digit 4 = 10 - Digit 3',
    },
  ]

  const puzzle: VaultRushPuzzle = {
    id: input.id,
    digitCount: VAULT_RUSH_DIGIT_COUNT,
    clues,
  }

  return {
    puzzle,
    code,
  }
}

function createSimpleEquation(answer: number, random: () => number): string {
  const offset = randomInt(random, 1, 4)

  if (answer + offset <= 9) {
    return `${answer + offset} - ${offset}`
  }

  return `${answer - offset} + ${offset}`
}

function createSeededRandom(seed: string): () => number {
  let state = hashString(seed)

  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / RANDOM_DIVISOR
  }
}

function hashString(value: string): number {
  let hash = HASH_INITIAL_VALUE

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, HASH_MULTIPLIER)
  }

  return hash >>> 0
}

function randomInt(random: () => number, min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min
}
