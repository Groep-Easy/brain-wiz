import { generateScalePuzzle, type ItemOption, type ScalePuzzle } from '../shared/scaleGame.js'
import {
  EASY_SCALE_DIFFICULTY,
  HARD_SCALE_DIFFICULTY,
  type ScaleDifficulty,
} from '../shared/scaleGame.constants.js'

export const SAMPLE_ITEM_POOLS: Record<ScaleDifficulty, ItemOption[][]> = {
  [EASY_SCALE_DIFFICULTY]: [
    [
      {
        id: 'apple',
        label: 'Apple',
        emoji: '🍎',
        weight: 1,
      },
      {
        id: 'ball',
        label: 'Ball',
        emoji: '⚽',
        weight: 2,
      },
      {
        id: 'brick',
        label: 'Brick',
        emoji: '🧱',
        weight: 3,
      },
    ],
    [
      {
        id: 'coin',
        label: 'Coin',
        emoji: '🪙',
        weight: 1,
      },
      {
        id: 'cake',
        label: 'Cake',
        emoji: '🍰',
        weight: 2,
      },
      {
        id: 'box',
        label: 'Box',
        emoji: '📦',
        weight: 3,
      },
    ],
    [
      {
        id: 'key',
        label: 'Key',
        emoji: '🔑',
        weight: 1,
      },
      {
        id: 'book',
        label: 'Book',
        emoji: '📘',
        weight: 2,
      },
      {
        id: 'gem',
        label: 'Gem',
        emoji: '💎',
        weight: 3,
      },
    ],
    [
      {
        id: 'star',
        label: 'Star',
        emoji: '⭐',
        weight: 1,
      },
      {
        id: 'mug',
        label: 'Mug',
        emoji: '☕',
        weight: 2,
      },
      {
        id: 'crown',
        label: 'Crown',
        emoji: '👑',
        weight: 3,
      },
    ],
    [
      {
        id: 'ticket',
        label: 'Ticket',
        emoji: '🎟️',
        weight: 1,
      },
      {
        id: 'lamp',
        label: 'Lamp',
        emoji: '💡',
        weight: 2,
      },
      {
        id: 'gift',
        label: 'Gift',
        emoji: '🎁',
        weight: 3,
      },
    ],
  ],
  [HARD_SCALE_DIFFICULTY]: [
    [
      {
        id: 'apple',
        label: 'Apple',
        emoji: '🍎',
        weight: 1,
      },
      {
        id: 'ball',
        label: 'Ball',
        emoji: '⚽',
        weight: 2,
      },
      {
        id: 'brick',
        label: 'Brick',
        emoji: '🧱',
        weight: 3,
      },
      {
        id: 'vase',
        label: 'Vase',
        emoji: '🏺',
        weight: 4,
      },
    ],
    [
      {
        id: 'coin',
        label: 'Coin',
        emoji: '🪙',
        weight: 1,
      },
      {
        id: 'cake',
        label: 'Cake',
        emoji: '🍰',
        weight: 2,
      },
      {
        id: 'box',
        label: 'Box',
        emoji: '📦',
        weight: 3,
      },
      {
        id: 'rock',
        label: 'Rock',
        emoji: '🪨',
        weight: 4,
      },
    ],
    [
      {
        id: 'key',
        label: 'Key',
        emoji: '🔑',
        weight: 1,
      },
      {
        id: 'book',
        label: 'Book',
        emoji: '📘',
        weight: 2,
      },
      {
        id: 'gem',
        label: 'Gem',
        emoji: '💎',
        weight: 3,
      },
      {
        id: 'anchor',
        label: 'Anchor',
        emoji: '⚓',
        weight: 4,
      },
    ],
    [
      {
        id: 'star',
        label: 'Star',
        emoji: '⭐',
        weight: 1,
      },
      {
        id: 'mug',
        label: 'Mug',
        emoji: '☕',
        weight: 2,
      },
      {
        id: 'crown',
        label: 'Crown',
        emoji: '👑',
        weight: 3,
      },
      {
        id: 'safe',
        label: 'Safe',
        emoji: '🔒',
        weight: 4,
      },
    ],
    [
      {
        id: 'ticket',
        label: 'Ticket',
        emoji: '🎟️',
        weight: 1,
      },
      {
        id: 'lamp',
        label: 'Lamp',
        emoji: '💡',
        weight: 2,
      },
      {
        id: 'gift',
        label: 'Gift',
        emoji: '🎁',
        weight: 3,
      },
      {
        id: 'rocket',
        label: 'Rocket',
        emoji: '🚀',
        weight: 4,
      },
    ],
  ],
}

export function getSampleScalePuzzle(
  sampleIndex: number,
  difficulty: ScaleDifficulty = EASY_SCALE_DIFFICULTY
): ScalePuzzle {
  const pools = SAMPLE_ITEM_POOLS[difficulty]
  const itemPool = pools[sampleIndex % pools.length]
  if (!itemPool) {
    throw new Error(`No ${difficulty} sample balance-scale item pool is available`)
  }

  return generateScalePuzzle({
    id: `sample-balance-scale-${difficulty}-${sampleIndex}`,
    difficulty,
    itemPool,
  })
}

export const sampleScalePuzzle: ScalePuzzle = getSampleScalePuzzle(0)
