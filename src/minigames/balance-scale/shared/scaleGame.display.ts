/**
 * @file scaleGame.display.ts
 * @description Reads a generated puzzle for rendering: the correct option and
 * the items shown during the answering vs reveal phases.
 */
import { ANSWERING_SCALE_PHASE, type ScalePhase } from './scaleGame.constants.js'
import type { ItemOption, PlacedItem, ScalePuzzle } from './scaleGame.types.js'

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
