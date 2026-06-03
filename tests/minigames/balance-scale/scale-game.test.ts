import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  angleForItems,
  generateScalePuzzle,
  getDisplayedItems,
  totalTorque,
  type ScaleDifficulty,
  type ItemOption,
} from '../../../src/minigames/balance-scale/shared/scaleGame.js'
import { SAMPLE_ITEM_POOLS } from '../../../src/minigames/balance-scale/mock/samplePuzzle.js'

const EASY_ITEM_POOL: ItemOption[] = [
  {
    id: 'apple',
    label: 'Apple',
    emoji: 'apple',
    weight: 1,
  },
  {
    id: 'ball',
    label: 'Ball',
    emoji: 'ball',
    weight: 2,
  },
  {
    id: 'brick',
    label: 'Brick',
    emoji: 'brick',
    weight: 3,
  },
]

const HARD_ITEM_POOL: ItemOption[] = [
  ...EASY_ITEM_POOL,
  {
    id: 'vase',
    label: 'Vase',
    emoji: 'vase',
    weight: 4,
  },
]

describe('generateScalePuzzle', () => {
  it('generates easy puzzles with exactly three scale item types and two equations', () => {
    const puzzle = generateScalePuzzle({
      id: 'easy-test-puzzle',
      difficulty: 'easy',
      itemPool: EASY_ITEM_POOL,
    })

    const scaleItemIds = new Set(puzzle.placed.map((item) => item.id))
    const scaleSlots = [...puzzle.placed.map((item) => item.slot), puzzle.addTo.slot]

    if (puzzle.correctOptionId) {
      scaleItemIds.add(puzzle.correctOptionId)
    }

    assert.equal(puzzle.equations.length, 2)
    assert.equal(scaleItemIds.size, 3)
    assert.deepEqual(scaleSlots, [2, 2, 2])
    assert.deepEqual([...scaleItemIds].sort(), ['apple', 'ball', 'brick'])
    assert.equal(puzzle.correctOptionId, 'apple')
  })

  it('generates easy puzzles whose revealed answer balances the scale', () => {
    const puzzle = generateScalePuzzle({
      id: 'easy-balance-test-puzzle',
      difficulty: 'easy',
      itemPool: EASY_ITEM_POOL,
    })
    const revealedItems = getDisplayedItems(puzzle, 'reveal')

    assert.equal(totalTorque(revealedItems), 0)
    assert.equal(angleForItems(revealedItems), 0)
  })

  it('generates hard puzzles with exactly four scale item types and three equations', () => {
    const puzzle = generateScalePuzzle({
      id: 'hard-test-puzzle',
      difficulty: 'hard',
      itemPool: HARD_ITEM_POOL,
    })

    const scaleItemIds = new Set(puzzle.placed.map((item) => item.id))
    const scaleSlots = [...puzzle.placed.map((item) => item.slot), puzzle.addTo.slot]

    if (puzzle.correctOptionId) {
      scaleItemIds.add(puzzle.correctOptionId)
    }

    assert.equal(puzzle.equations.length, 3)
    assert.equal(scaleItemIds.size, 4)
    assert.deepEqual(scaleSlots, [2, 2, 2, 2])
    assert.deepEqual([...scaleItemIds].sort(), ['apple', 'ball', 'brick', 'vase'])
    assert.equal(puzzle.correctOptionId, 'ball')
  })

  it('generates every mock item pool without breaking the procedural rules', () => {
    const difficulties: ScaleDifficulty[] = ['easy', 'hard']

    difficulties.forEach((difficulty) => {
      SAMPLE_ITEM_POOLS[difficulty].forEach((itemPool, index) => {
        const puzzle = generateScalePuzzle({
          id: `${difficulty}-mock-pool-${index}`,
          difficulty,
          itemPool,
        })
        const revealedItems = getDisplayedItems(puzzle, 'reveal')

        assert.equal(totalTorque(revealedItems), 0)
        assert.equal(angleForItems(revealedItems), 0)
      })
    })
  })
})
