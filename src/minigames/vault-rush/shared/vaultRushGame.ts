import { VAULT_RUSH_DIGIT_COUNT } from './vaultRushGame.constants.js'
import type {
  VaultRushClue,
  VaultRushGeneratedRound,
  VaultRushGenerationInput,
  VaultRushPuzzle,
} from './vaultRushGame.types.js'

export type { VaultRushClue, VaultRushGeneratedRound, VaultRushGenerationInput, VaultRushPuzzle }

const FIRST_DIGIT_MIN = 1
const FIRST_DIGIT_MAX = 4
const SECOND_DIGIT_MIN = 2
const MAX_DIGIT_VALUE = 9
const CODE_DIGIT_SUM = 10
const EQUATION_OFFSET_MIN = 1
const EQUATION_OFFSET_MAX = 4
const RANDOM_STATE_INCREMENT = 0x6d2b79f5
const FIRST_RANDOM_SHIFT = 15
const SECOND_RANDOM_SHIFT = 7
const THIRD_RANDOM_SHIFT = 14
const RANDOM_MIX_OR_VALUE = 61
const HASH_MULTIPLIER = 31
const HASH_INITIAL_VALUE = 2166136261
const RANDOM_DIVISOR = 4294967296

export function createVaultRushRound(input: VaultRushGenerationInput): VaultRushGeneratedRound {
  const random = createSeededRandom(input.seed)

  const digitOne = randomInt(random, FIRST_DIGIT_MIN, FIRST_DIGIT_MAX)
  const digitTwo = randomInt(random, SECOND_DIGIT_MIN, MAX_DIGIT_VALUE - digitOne)
  const digitThree = digitOne + digitTwo
  const digitFour = CODE_DIGIT_SUM - digitThree

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
  const offset = randomInt(random, EQUATION_OFFSET_MIN, EQUATION_OFFSET_MAX)

  if (answer + offset <= MAX_DIGIT_VALUE) {
    return `${answer + offset} - ${offset}`
  }

  return `${answer - offset} + ${offset}`
}

function createSeededRandom(seed: string): () => number {
  let state = hashString(seed)

  return () => {
    state += RANDOM_STATE_INCREMENT
    let value = state
    value = Math.imul(value ^ (value >>> FIRST_RANDOM_SHIFT), value | 1)
    value ^= value + Math.imul(value ^ (value >>> SECOND_RANDOM_SHIFT), value | RANDOM_MIX_OR_VALUE)
    return ((value ^ (value >>> THIRD_RANDOM_SHIFT)) >>> 0) / RANDOM_DIVISOR
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
