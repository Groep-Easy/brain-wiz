export type Side = 'left' | 'right'

export type SideSign = typeof LEFT_SIDE_SIGN | typeof RIGHT_SIDE_SIGN

/**
 * Pure balance-scale model and math.
 * No sockets, database calls, browser APIs, or asset loading in this file.
 */
export interface ItemOption {
  id: string
  label: string
  emoji: string
  weight: number
}

export interface PlacedItem extends ItemOption {
  side: Side
  slot: number
  isNew?: boolean
}

export interface ScaleSlotPosition {
  side: Side
  slot: number
}

export interface ItemStack {
  item: ItemOption
  count: number
}

export interface ScaleEquation {
  id: string
  left: ItemStack[]
  right: ItemStack[]
}

export interface ScalePuzzle {
  id: string
  placed: PlacedItem[]
  addTo: ScaleSlotPosition
  options: ItemOption[]
  equations: ScaleEquation[]
  /**
   * Keep server-side while players are answering.
   * Client answer payload: { roomId, playerId, puzzleId, optionId }.
   */
  correctOptionId?: string
}

export interface ScalePuzzleRulesInput {
  id: string
  placed: PlacedItem[]
  addTo: ScaleSlotPosition
  options: ItemOption[]
  equations?: ScaleEquation[]
}

export type ScaleDifficulty = 'easy' | 'hard'

export interface ScalePuzzleGenerationInput {
  id: string
  difficulty: ScaleDifficulty
  /**
   * Later: load from DB/static content by room/round.
   * Store image references here, not image binary data.
   */
  itemPool: ItemOption[]
}

export type ScalePhase = 'answering' | 'reveal'

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
  easy: 3,
  hard: 4,
}

const DIFFICULTY_EQUATION_COUNT: Record<ScaleDifficulty, number> = {
  easy: 2,
  hard: 3,
}

const GENERATED_SCALE_SLOT = 2

export function sideSign(side: Side): SideSign {
  return side === 'left' ? LEFT_SIDE_SIGN : RIGHT_SIDE_SIGN
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

  if (scaleItemIds.size !== DIFFICULTY_ITEM_COUNT[difficulty]) {
    throw new Error(
      `Balance-scale ${difficulty} puzzle must use exactly ${DIFFICULTY_ITEM_COUNT[difficulty]} different scale item types`
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

  const puzzle = createScalePuzzleFromRules({
    id: input.id,
    placed: [
      toPlacedItem(mediumItem, 'left', GENERATED_SCALE_SLOT),
      toPlacedItem(heavyItem, 'right', GENERATED_SCALE_SLOT),
    ],
    addTo: {
      side: 'left',
      slot: GENERATED_SCALE_SLOT,
    },
    options: selectedItems,
    equations: createMinimumEquations(selectedItems),
  })

  validateGeneratedPuzzleShape(puzzle, input.difficulty)
  return puzzle
}

function generateHardScalePuzzle(input: ScalePuzzleGenerationInput): ScalePuzzle {
  const selectedItems = getSortedPuzzleItems(input)
  const [baseItem, secondItem, thirdItem] = selectedItems
  const lastItem = selectedItems[selectedItems.length - 1]

  if (!baseItem || !secondItem || !thirdItem || !lastItem) {
    throw new Error('Hard balance-scale puzzle could not select enough item types')
  }

  const puzzle = createScalePuzzleFromRules({
    id: input.id,
    placed: [
      toPlacedItem(lastItem, 'left', GENERATED_SCALE_SLOT),
      toPlacedItem(baseItem, 'left', GENERATED_SCALE_SLOT),
      toPlacedItem(thirdItem, 'right', GENERATED_SCALE_SLOT),
    ],
    addTo: {
      side: 'right',
      slot: GENERATED_SCALE_SLOT,
    },
    options: selectedItems,
    equations: createMinimumEquations(selectedItems),
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
  if (input.difficulty === 'easy') {
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
  if (phase === 'answering') {
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
