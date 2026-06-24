/**
 * @file scaleGame.generate.ts
 * @description Procedural balance-scale puzzle generation: select items, lay
 * out a stable variant, attach equations, and validate the result.
 */
import {
  DIFFICULTY_EQUATION_COUNT,
  DIFFICULTY_ITEM_COUNT,
  EASY_SCALE_DIFFICULTY,
  FOURTH,
  GENERATED_SCALE_SLOT,
  LEFT_SIDE,
  LIGHTEST,
  MIN_SCALE_ITEM_TYPES,
  NUMERIC_SUFFIX_PATTERN,
  RIGHT_SIDE,
  SECOND,
  THIRD,
  type ScaleDifficulty,
  type Side,
} from './scaleGame.constants.js'
import type {
  ItemOption,
  PlacedItem,
  ScalePuzzle,
  ScalePuzzleGenerationInput,
  ScalePuzzleRulesInput,
  ScaleSlotPosition,
  ScaleVariantLayout,
} from './scaleGame.types.js'
import { getBalancingOptions, requiredWeightForBalance } from './scaleGame.physics.js'
import { createEasyEquations, createHardEquations } from './scaleGame.equations.js'

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

const EASY_VARIANT_LAYOUTS: readonly ScaleVariantLayout[] = [
  {
    placed: [
      [SECOND, LEFT_SIDE],
      [SECOND, LEFT_SIDE],
      [LIGHTEST, RIGHT_SIDE],
    ],
    addTo: RIGHT_SIDE,
  },
  {
    placed: [
      [SECOND, LEFT_SIDE],
      [SECOND, LEFT_SIDE],
      [THIRD, RIGHT_SIDE],
    ],
    addTo: RIGHT_SIDE,
  },
  {
    placed: [
      [THIRD, LEFT_SIDE],
      [LIGHTEST, LEFT_SIDE],
      [THIRD, RIGHT_SIDE],
    ],
    addTo: RIGHT_SIDE,
  },
  {
    placed: [
      [SECOND, LEFT_SIDE],
      [LIGHTEST, LEFT_SIDE],
      [LIGHTEST, RIGHT_SIDE],
    ],
    addTo: RIGHT_SIDE,
  },
]

const HARD_VARIANT_LAYOUTS: readonly ScaleVariantLayout[] = [
  {
    placed: [
      [FOURTH, LEFT_SIDE],
      [THIRD, RIGHT_SIDE],
      [SECOND, LEFT_SIDE],
      [SECOND, RIGHT_SIDE],
    ],
    addTo: RIGHT_SIDE,
  },
  {
    placed: [
      [FOURTH, LEFT_SIDE],
      [THIRD, LEFT_SIDE],
      [FOURTH, RIGHT_SIDE],
      [LIGHTEST, RIGHT_SIDE],
    ],
    addTo: RIGHT_SIDE,
  },
  {
    placed: [
      [FOURTH, LEFT_SIDE],
      [SECOND, LEFT_SIDE],
      [LIGHTEST, RIGHT_SIDE],
      [SECOND, RIGHT_SIDE],
    ],
    addTo: RIGHT_SIDE,
  },
  {
    placed: [
      [LIGHTEST, LEFT_SIDE],
      [SECOND, LEFT_SIDE],
      [THIRD, LEFT_SIDE],
      [SECOND, RIGHT_SIDE],
    ],
    addTo: RIGHT_SIDE,
  },
  {
    placed: [
      [LIGHTEST, LEFT_SIDE],
      [SECOND, LEFT_SIDE],
      [LIGHTEST, RIGHT_SIDE],
      [THIRD, RIGHT_SIDE],
    ],
    addTo: LEFT_SIDE,
  },
  {
    placed: [
      [LIGHTEST, LEFT_SIDE],
      [SECOND, LEFT_SIDE],
      [LIGHTEST, RIGHT_SIDE],
      [FOURTH, RIGHT_SIDE],
    ],
    addTo: LEFT_SIDE,
  },
  {
    placed: [
      [LIGHTEST, LEFT_SIDE],
      [LIGHTEST, LEFT_SIDE],
      [SECOND, RIGHT_SIDE],
      [THIRD, RIGHT_SIDE],
    ],
    addTo: LEFT_SIDE,
  },
  {
    placed: [
      [LIGHTEST, LEFT_SIDE],
      [LIGHTEST, LEFT_SIDE],
      [SECOND, RIGHT_SIDE],
      [FOURTH, RIGHT_SIDE],
    ],
    addTo: LEFT_SIDE,
  },
]

/** Build the placed items and answer slot for a variant from the sorted items. */
function buildVariantPlacement(
  layout: ScaleVariantLayout,
  items: ItemOption[]
): { placed: PlacedItem[]; addTo: ScaleSlotPosition } {
  const placed = layout.placed.map(([itemIndex, side]) => {
    const item = items[itemIndex]
    if (!item) {
      throw new Error(`Scale variant layout references missing item index ${itemIndex}`)
    }
    return toPlacedItem(item, side, GENERATED_SCALE_SLOT)
  })
  return { placed, addTo: { side: layout.addTo, slot: GENERATED_SCALE_SLOT } }
}

/** Pick a variant layout for a puzzle, stable for a given seed/id. */
function pickVariantLayout(
  layouts: readonly ScaleVariantLayout[],
  seed: string
): ScaleVariantLayout {
  const index = getStablePuzzleVariantIndex(seed, layouts.length)
  const layout = layouts[index] ?? layouts[layouts.length - 1]
  if (!layout) {
    throw new Error('No balance-scale variant layouts are defined')
  }
  return layout
}

/** Validate that a generated puzzle has the correct shape for its difficulty. */
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

/** Generate a balance-scale puzzle for a given difficulty, item pool, and seed. */
function generateEasyScalePuzzle(input: ScalePuzzleGenerationInput): ScalePuzzle {
  const selectedItems = getSortedPuzzleItems(input)
  const layout = pickVariantLayout(EASY_VARIANT_LAYOUTS, input.seed ?? input.id)
  const { placed, addTo } = buildVariantPlacement(layout, selectedItems)

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

/** Generate a balance-scale puzzle for a given difficulty, item pool, and seed. */
function generateHardScalePuzzle(input: ScalePuzzleGenerationInput): ScalePuzzle {
  const selectedItems = getSortedPuzzleItems(input)
  const layout = pickVariantLayout(HARD_VARIANT_LAYOUTS, input.seed ?? input.id)
  const { placed, addTo } = buildVariantPlacement(layout, selectedItems)

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

/** Generate a balance-scale puzzle for a given difficulty, item pool, and seed. */
export function generateScalePuzzle(input: ScalePuzzleGenerationInput): ScalePuzzle {
  if (input.difficulty === EASY_SCALE_DIFFICULTY) {
    return generateEasyScalePuzzle(input)
  }

  return generateHardScalePuzzle(input)
}
