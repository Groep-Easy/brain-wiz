import {
  EASY_SCALE_DIFFICULTY,
  HARD_SCALE_DIFFICULTY,
  type ScaleDifficulty,
} from './scaleGame.constants.js'
import type { ItemOption } from './scaleGame.types.js'

export const DEFAULT_SCALE_ITEM_POOLS: Record<ScaleDifficulty, ItemOption[][]> = {
  [EASY_SCALE_DIFFICULTY]: [
    [
      { id: 'apple', label: 'Apple', emoji: 'A', weight: 1 },
      { id: 'ball', label: 'Ball', emoji: 'B', weight: 2 },
      { id: 'brick', label: 'Brick', emoji: 'C', weight: 3 },
    ],
    [
      { id: 'coin', label: 'Coin', emoji: 'D', weight: 1 },
      { id: 'book', label: 'Book', emoji: 'E', weight: 2 },
      { id: 'box', label: 'Box', emoji: 'F', weight: 3 },
    ],
  ],
  [HARD_SCALE_DIFFICULTY]: [
    [
      { id: 'apple', label: 'Apple', emoji: 'A', weight: 1 },
      { id: 'ball', label: 'Ball', emoji: 'B', weight: 2 },
      { id: 'brick', label: 'Brick', emoji: 'C', weight: 3 },
      { id: 'vase', label: 'Vase', emoji: 'D', weight: 4 },
    ],
    [
      { id: 'coin', label: 'Coin', emoji: 'E', weight: 1 },
      { id: 'book', label: 'Book', emoji: 'F', weight: 2 },
      { id: 'box', label: 'Box', emoji: 'G', weight: 3 },
      { id: 'rock', label: 'Rock', emoji: 'H', weight: 4 },
    ],
  ],
}

export function getDefaultScaleItemPool(
  seedIndex: number,
  difficulty: ScaleDifficulty
): ItemOption[] {
  const pools = DEFAULT_SCALE_ITEM_POOLS[difficulty]
  const pool = pools[seedIndex % pools.length]
  if (!pool) {
    throw new Error(`No ${difficulty} balance-scale item pool is available`)
  }
  return pool
}
