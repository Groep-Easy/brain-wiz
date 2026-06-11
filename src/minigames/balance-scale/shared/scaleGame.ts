import {
  ANSWERING_SCALE_PHASE,
  EASY_SCALE_DIFFICULTY,
  HARD_SCALE_DIFFICULTY,
  LEFT_SIDE,
  RIGHT_SIDE,
  type ScaleDifficulty,
  type ScalePhase,
  type Side,
} from './scaleGame.constants.js'
import type {
  ItemOption,
  PlacedItem,
  ScaleEquation,
  ScalePuzzle,
  ScalePuzzleGenerationInput,
  ScalePuzzleRulesInput,
  ScaleSlotPosition,
} from './scaleGame.types.js'

export {
  ANSWERING_SCALE_PHASE,
  EASY_SCALE_DIFFICULTY,
  HARD_SCALE_DIFFICULTY,
  LEFT_SIDE,
  REVEAL_SCALE_PHASE,
  RIGHT_SIDE,
  SCALE_DIFFICULTIES,
  SCALE_PHASES,
  SCALE_SIDES,
} from './scaleGame.constants.js'
export type { ScaleDifficulty, ScalePhase, Side } from './scaleGame.constants.js'
export type {
  ItemOption,
  ItemStack,
  PlacedItem,
  ScaleEquation,
  ScalePuzzle,
  ScalePuzzleGenerationInput,
  ScalePuzzleRulesInput,
  ScaleSlotPosition,
} from './scaleGame.types.js'

export type SideSign = typeof LEFT_SIDE_SIGN | typeof RIGHT_SIDE_SIGN

/**
 * Pure balance-scale model and math.
 * No sockets, database calls, browser APIs, or asset loading in this file.
 */
export const SVG_WIDTH = 800
export const SVG_HEIGHT = 480
export const PIVOT_X = 400
export const PIVOT_Y = 260
export const SLOT_SIZE = 90
export const BEAM_HALF_WIDTH = 280
export const PIVOT_COLOR = '#ff2bd6'

const DEGREES_PER_TORQUE = 4
const MIN_VISUAL_ANGLE = -16
const MAX_VISUAL_ANGLE = 16
const WEIGHT_MATCH_EPSILON = 0.0001
const LEFT_SIDE_SIGN = -1
const RIGHT_SIDE_SIGN = 1

const DIFFICULTY_ITEM_COUNT: Record<ScaleDifficulty, number> = {
  [EASY_SCALE_DIFFICULTY]: 3,
  [HARD_SCALE_DIFFICULTY]: 4,
}

const DIFFICULTY_EQUATION_COUNT: Record<ScaleDifficulty, number> = {
  [EASY_SCALE_DIFFICULTY]: 2,
  [HARD_SCALE_DIFFICULTY]: 3,
}

const GENERATED_SCALE_SLOT = 2
const MIN_SCALE_ITEM_TYPES = 2
const EASY_SCALE_VARIANT_COUNT = 4
const HARD_SCALE_VARIANT_COUNT = 8
const EASY_LIGHT_DUPLICATE_ANSWER_VARIANT = 2
const HARD_THIRD_MISSING_ANSWER_VARIANT = 2
const HARD_FOURTH_MISSING_ANSWER_VARIANT = 3
const HARD_BASE_DUPLICATE_ANSWER_VARIANT = 4
const HARD_SECOND_DUPLICATE_ANSWER_VARIANT = 5
const HARD_THIRD_DUPLICATE_ANSWER_VARIANT = 6
const NUMERIC_SUFFIX_PATTERN = /\d+$/

export function sideSign(side: Side): SideSign {
  return side === LEFT_SIDE ? LEFT_SIDE_SIGN : RIGHT_SIDE_SIGN
}

export function torqueOf(item: PlacedItem): number {
  return sideSign(item.side) * item.slot * item.weight
}

export function totalTorque(items: PlacedItem[]): number {
  return items.reduce((sum, item) => sum + torqueOf(item), 0)
}

export function neededTorqueForBalance(items: PlacedItem[]): number {
  return -totalTorque(items)
}

export function requiredWeightForBalance(
  items: PlacedItem[],
  addTo: ScaleSlotPosition
): number | undefined {
  const torquePerWeight = sideSign(addTo.side) * addTo.slot
  if (torquePerWeight === 0) {
    return undefined
  }

  const requiredWeight = neededTorqueForBalance(items) / torquePerWeight
  return requiredWeight > 0 ? requiredWeight : undefined
}

export function getBalancingOptions(
  options: ItemOption[],
  items: PlacedItem[],
  addTo: ScaleSlotPosition
): ItemOption[] {
  const requiredWeight = requiredWeightForBalance(items, addTo)
  if (requiredWeight === undefined) {
    return []
  }

  return options.filter(
    (option) => Math.abs(option.weight - requiredWeight) <= WEIGHT_MATCH_EPSILON
  )
}

export function createScalePuzzleFromRules(input: ScalePuzzleRulesInput): ScalePuzzle {
  const [correctOption] = getBalancingOptions(input.options, input.placed, input.addTo)
  if (!correctOption) {
    const requiredWeight = requiredWeightForBalance(input.placed, input.addTo)
    throw new Error(
      `No balance-scale option can solve puzzle "${input.id}" at ${input.addTo.side} slot ${input.addTo.slot}; required weight is ${requiredWeight ?? 'not positive'}`
    )
  }

  return {
    id: input.id,
    placed: input.placed,
    addTo: input.addTo,
    options: input.options,
    equations: input.equations ?? [],
    correctOptionId: correctOption.id,
  }
}

function getSortedPuzzleItems(input: ScalePuzzleGenerationInput): ItemOption[] {
  const itemCount = DIFFICULTY_ITEM_COUNT[input.difficulty]
  const sortedItems = [...input.itemPool].sort((first, second) => first.weight - second.weight)

  if (sortedItems.length < itemCount) {
    throw new Error(
      `Balance-scale ${input.difficulty} puzzle needs ${itemCount} item types, but only ${sortedItems.length} were provided`
    )
  }

  return sortedItems.slice(0, itemCount)
}

export function createMinimumEquations(items: ItemOption[]): ScaleEquation[] {
  const sortedItems = [...items].sort((first, second) => first.weight - second.weight)
  const [baseItem] = sortedItems
  if (!baseItem) {
    return []
  }

  return sortedItems.slice(1).map((item) => ({
    id: `${item.id}-equals-${baseItem.id}`,
    left: [
      {
        item: baseItem,
        count: item.weight / baseItem.weight,
      },
    ],
    right: [
      {
        item,
        count: 1,
      },
    ],
  }))
}

function createEasyEquations(items: ItemOption[]): ScaleEquation[] {
  const sortedItems = [...items].sort((first, second) => first.weight - second.weight)
  const [baseItem, mediumItem, heavyItem] = sortedItems

  if (!baseItem || !mediumItem || !heavyItem) {
    return createMinimumEquations(items)
  }

  return [
    {
      id: `${mediumItem.id}-equals-${baseItem.id}`,
      left: [
        {
          item: baseItem,
          count: mediumItem.weight / baseItem.weight,
        },
      ],
      right: [
        {
          item: mediumItem,
          count: 1,
        },
      ],
    },
    {
      id: `${mediumItem.id}-${heavyItem.id}-equals-${baseItem.id}`,
      left: [
        {
          item: baseItem,
          count: (mediumItem.weight + heavyItem.weight) / baseItem.weight,
        },
      ],
      right: [
        {
          item: mediumItem,
          count: 1,
        },
        {
          item: heavyItem,
          count: 1,
        },
      ],
    },
  ]
}

function createHardEquations(items: ItemOption[]): ScaleEquation[] {
  const sortedItems = [...items].sort((first, second) => first.weight - second.weight)
  const [baseItem, secondItem, thirdItem, fourthItem] = sortedItems

  if (!baseItem || !secondItem || !thirdItem || !fourthItem) {
    return createMinimumEquations(items)
  }

  return [
    {
      id: `${secondItem.id}-equals-${baseItem.id}`,
      left: [
        {
          item: baseItem,
          count: secondItem.weight / baseItem.weight,
        },
      ],
      right: [
        {
          item: secondItem,
          count: 1,
        },
      ],
    },
    {
      id: `${secondItem.id}-${thirdItem.id}-equals-${baseItem.id}`,
      left: [
        {
          item: baseItem,
          count: (secondItem.weight + thirdItem.weight) / baseItem.weight,
        },
      ],
      right: [
        {
          item: secondItem,
          count: 1,
        },
        {
          item: thirdItem,
          count: 1,
        },
      ],
    },
    {
      id: `${secondItem.id}-${thirdItem.id}-${fourthItem.id}-equals-${baseItem.id}`,
      left: [
        {
          item: baseItem,
          count: (secondItem.weight + thirdItem.weight + fourthItem.weight) / baseItem.weight,
        },
      ],
      right: [
        {
          item: secondItem,
          count: 1,
        },
        {
          item: thirdItem,
          count: 1,
        },
        {
          item: fourthItem,
          count: 1,
        },
      ],
    },
  ]
}

function getStablePuzzleVariantIndex(id: string, variantCount: number): number {
  const numericSuffix = NUMERIC_SUFFIX_PATTERN.exec(id)?.[0]
  if (numericSuffix !== undefined) {
    return Number(numericSuffix) % variantCount
  }

  return Array.from(id).reduce((sum, character) => sum + character.charCodeAt(0), 0) % variantCount
}

function toPlacedItem(item: ItemOption, side: Side, slot: number): PlacedItem {
  return {
    ...item,
    side,
    slot,
  }
}

function validateGeneratedPuzzleShape(puzzle: ScalePuzzle, difficulty: ScaleDifficulty): void {
  const requiredEquationCount = DIFFICULTY_EQUATION_COUNT[difficulty]
  if (puzzle.equations.length !== requiredEquationCount) {
    throw new Error(
      `Balance-scale ${difficulty} puzzle must have exactly ${requiredEquationCount} visual equations`
    )
  }

  const scaleItemIds = new Set(puzzle.placed.map((item) => item.id))
  if (puzzle.correctOptionId) {
    scaleItemIds.add(puzzle.correctOptionId)
  }

  if (scaleItemIds.size > DIFFICULTY_ITEM_COUNT[difficulty]) {
    throw new Error(
      `Balance-scale ${difficulty} puzzle must not use more than ${DIFFICULTY_ITEM_COUNT[difficulty]} different scale item types`
    )
  }

  if (scaleItemIds.size < MIN_SCALE_ITEM_TYPES) {
    throw new Error(
      `Balance-scale ${difficulty} puzzle must use at least two different scale item types`
    )
  }

  const scaleSlots = [...puzzle.placed.map((item) => item.slot), puzzle.addTo.slot]
  if (scaleSlots.some((slot) => slot !== GENERATED_SCALE_SLOT)) {
    throw new Error(`Balance-scale ${difficulty} puzzle must use equal slot distances`)
  }
}

function generateEasyScalePuzzle(input: ScalePuzzleGenerationInput): ScalePuzzle {
  const selectedItems = getSortedPuzzleItems(input)
  const [lightItem, mediumItem, heavyItem] = selectedItems

  if (!lightItem || !mediumItem || !heavyItem) {
    throw new Error('Easy balance-scale puzzle could not select exactly three item types')
  }

  const variantIndex = getStablePuzzleVariantIndex(input.seed ?? input.id, EASY_SCALE_VARIANT_COUNT)
  let placed: PlacedItem[]
  let addTo: ScaleSlotPosition

  if (variantIndex === 0) {
    placed = [
      toPlacedItem(mediumItem, LEFT_SIDE, GENERATED_SCALE_SLOT),
      toPlacedItem(mediumItem, LEFT_SIDE, GENERATED_SCALE_SLOT),
      toPlacedItem(lightItem, RIGHT_SIDE, GENERATED_SCALE_SLOT),
    ]
    addTo = {
      side: RIGHT_SIDE,
      slot: GENERATED_SCALE_SLOT,
    }
  } else if (variantIndex === 1) {
    placed = [
      toPlacedItem(mediumItem, LEFT_SIDE, GENERATED_SCALE_SLOT),
      toPlacedItem(mediumItem, LEFT_SIDE, GENERATED_SCALE_SLOT),
      toPlacedItem(heavyItem, RIGHT_SIDE, GENERATED_SCALE_SLOT),
    ]
    addTo = {
      side: RIGHT_SIDE,
      slot: GENERATED_SCALE_SLOT,
    }
  } else if (variantIndex === EASY_LIGHT_DUPLICATE_ANSWER_VARIANT) {
    placed = [
      toPlacedItem(heavyItem, LEFT_SIDE, GENERATED_SCALE_SLOT),
      toPlacedItem(lightItem, LEFT_SIDE, GENERATED_SCALE_SLOT),
      toPlacedItem(heavyItem, RIGHT_SIDE, GENERATED_SCALE_SLOT),
    ]
    addTo = {
      side: RIGHT_SIDE,
      slot: GENERATED_SCALE_SLOT,
    }
  } else {
    placed = [
      toPlacedItem(mediumItem, LEFT_SIDE, GENERATED_SCALE_SLOT),
      toPlacedItem(lightItem, LEFT_SIDE, GENERATED_SCALE_SLOT),
      toPlacedItem(lightItem, RIGHT_SIDE, GENERATED_SCALE_SLOT),
    ]
    addTo = {
      side: RIGHT_SIDE,
      slot: GENERATED_SCALE_SLOT,
    }
  }

  const puzzle = createScalePuzzleFromRules({
    id: input.id,
    placed,
    addTo,
    options: selectedItems,
    equations: createEasyEquations(selectedItems),
  })

  validateGeneratedPuzzleShape(puzzle, input.difficulty)
  return puzzle
}

function generateHardScalePuzzle(input: ScalePuzzleGenerationInput): ScalePuzzle {
  const selectedItems = getSortedPuzzleItems(input)
  const [baseItem, secondItem, thirdItem, fourthItem] = selectedItems

  if (!baseItem || !secondItem || !thirdItem || !fourthItem) {
    throw new Error('Hard balance-scale puzzle could not select enough item types')
  }

  const variantIndex = getStablePuzzleVariantIndex(input.seed ?? input.id, HARD_SCALE_VARIANT_COUNT)
  let placed: PlacedItem[]
  let addTo: ScaleSlotPosition

  if (variantIndex === 0) {
    placed = [
      toPlacedItem(fourthItem, LEFT_SIDE, GENERATED_SCALE_SLOT),
      toPlacedItem(thirdItem, RIGHT_SIDE, GENERATED_SCALE_SLOT),
      toPlacedItem(secondItem, LEFT_SIDE, GENERATED_SCALE_SLOT),
      toPlacedItem(secondItem, RIGHT_SIDE, GENERATED_SCALE_SLOT),
    ]
    addTo = {
      side: RIGHT_SIDE,
      slot: GENERATED_SCALE_SLOT,
    }
  } else if (variantIndex === 1) {
    placed = [
      toPlacedItem(fourthItem, LEFT_SIDE, GENERATED_SCALE_SLOT),
      toPlacedItem(thirdItem, LEFT_SIDE, GENERATED_SCALE_SLOT),
      toPlacedItem(fourthItem, RIGHT_SIDE, GENERATED_SCALE_SLOT),
      toPlacedItem(baseItem, RIGHT_SIDE, GENERATED_SCALE_SLOT),
    ]
    addTo = {
      side: RIGHT_SIDE,
      slot: GENERATED_SCALE_SLOT,
    }
  } else if (variantIndex === HARD_THIRD_MISSING_ANSWER_VARIANT) {
    placed = [
      toPlacedItem(fourthItem, LEFT_SIDE, GENERATED_SCALE_SLOT),
      toPlacedItem(secondItem, LEFT_SIDE, GENERATED_SCALE_SLOT),
      toPlacedItem(baseItem, RIGHT_SIDE, GENERATED_SCALE_SLOT),
      toPlacedItem(secondItem, RIGHT_SIDE, GENERATED_SCALE_SLOT),
    ]
    addTo = {
      side: RIGHT_SIDE,
      slot: GENERATED_SCALE_SLOT,
    }
  } else if (variantIndex === HARD_FOURTH_MISSING_ANSWER_VARIANT) {
    placed = [
      toPlacedItem(baseItem, LEFT_SIDE, GENERATED_SCALE_SLOT),
      toPlacedItem(secondItem, LEFT_SIDE, GENERATED_SCALE_SLOT),
      toPlacedItem(thirdItem, LEFT_SIDE, GENERATED_SCALE_SLOT),
      toPlacedItem(secondItem, RIGHT_SIDE, GENERATED_SCALE_SLOT),
    ]
    addTo = {
      side: RIGHT_SIDE,
      slot: GENERATED_SCALE_SLOT,
    }
  } else if (variantIndex === HARD_BASE_DUPLICATE_ANSWER_VARIANT) {
    placed = [
      toPlacedItem(baseItem, LEFT_SIDE, GENERATED_SCALE_SLOT),
      toPlacedItem(secondItem, LEFT_SIDE, GENERATED_SCALE_SLOT),
      toPlacedItem(baseItem, RIGHT_SIDE, GENERATED_SCALE_SLOT),
      toPlacedItem(thirdItem, RIGHT_SIDE, GENERATED_SCALE_SLOT),
    ]
    addTo = {
      side: LEFT_SIDE,
      slot: GENERATED_SCALE_SLOT,
    }
  } else if (variantIndex === HARD_SECOND_DUPLICATE_ANSWER_VARIANT) {
    placed = [
      toPlacedItem(baseItem, LEFT_SIDE, GENERATED_SCALE_SLOT),
      toPlacedItem(secondItem, LEFT_SIDE, GENERATED_SCALE_SLOT),
      toPlacedItem(baseItem, RIGHT_SIDE, GENERATED_SCALE_SLOT),
      toPlacedItem(fourthItem, RIGHT_SIDE, GENERATED_SCALE_SLOT),
    ]
    addTo = {
      side: LEFT_SIDE,
      slot: GENERATED_SCALE_SLOT,
    }
  } else if (variantIndex === HARD_THIRD_DUPLICATE_ANSWER_VARIANT) {
    placed = [
      toPlacedItem(baseItem, LEFT_SIDE, GENERATED_SCALE_SLOT),
      toPlacedItem(baseItem, LEFT_SIDE, GENERATED_SCALE_SLOT),
      toPlacedItem(secondItem, RIGHT_SIDE, GENERATED_SCALE_SLOT),
      toPlacedItem(thirdItem, RIGHT_SIDE, GENERATED_SCALE_SLOT),
    ]
    addTo = {
      side: LEFT_SIDE,
      slot: GENERATED_SCALE_SLOT,
    }
  } else {
    placed = [
      toPlacedItem(baseItem, LEFT_SIDE, GENERATED_SCALE_SLOT),
      toPlacedItem(baseItem, LEFT_SIDE, GENERATED_SCALE_SLOT),
      toPlacedItem(secondItem, RIGHT_SIDE, GENERATED_SCALE_SLOT),
      toPlacedItem(fourthItem, RIGHT_SIDE, GENERATED_SCALE_SLOT),
    ]
    addTo = {
      side: LEFT_SIDE,
      slot: GENERATED_SCALE_SLOT,
    }
  }

  const puzzle = createScalePuzzleFromRules({
    id: input.id,
    placed,
    addTo,
    options: selectedItems,
    equations: createHardEquations(selectedItems),
  })

  validateGeneratedPuzzleShape(puzzle, input.difficulty)
  return puzzle
}

export function generateScalePuzzle(input: ScalePuzzleGenerationInput): ScalePuzzle {
  /**
   * Server entry point later.
   * Persist puzzle by roomId/roundId, then broadcast public data to host/client.
   * Player answers/results should live outside ScalePuzzle.
   */
  if (input.difficulty === EASY_SCALE_DIFFICULTY) {
    return generateEasyScalePuzzle(input)
  }

  return generateHardScalePuzzle(input)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function angleForItems(items: PlacedItem[]): number {
  return clamp(totalTorque(items) * DEGREES_PER_TORQUE, MIN_VISUAL_ANGLE, MAX_VISUAL_ANGLE)
}

export function getCorrectOption(puzzle: ScalePuzzle): ItemOption | undefined {
  if (!puzzle.correctOptionId) {
    return undefined
  }

  return puzzle.options.find((option) => option.id === puzzle.correctOptionId)
}

export function getDisplayedItems(puzzle: ScalePuzzle, phase: ScalePhase): PlacedItem[] {
  if (phase === ANSWERING_SCALE_PHASE) {
    return puzzle.placed
  }

  const correctOption = getCorrectOption(puzzle)
  if (!correctOption) {
    return puzzle.placed
  }

  return [
    ...puzzle.placed,
    {
      ...correctOption,
      side: puzzle.addTo.side,
      slot: puzzle.addTo.slot,
      isNew: true,
    },
  ]
}

export function getSlotX(side: Side, slot: number): number {
  return PIVOT_X + sideSign(side) * slot * SLOT_SIZE
}
