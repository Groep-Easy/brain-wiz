import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  angleForItems,
  generateScalePuzzle,
  getDisplayedItems,
  totalTorque,
  type ItemOption,
  type ScaleEquation,
  type ScalePuzzle,
} from '../../../src/minigames/balance-scale/shared/scaleGame.js'
import {
  EASY_SCALE_DIFFICULTY,
  HARD_SCALE_DIFFICULTY,
  REVEAL_SCALE_PHASE,
  SCALE_DIFFICULTIES,
} from '../../../src/minigames/balance-scale/shared/scaleGame.constants.js'
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

function getEquationSummary(equation: ScaleEquation): {
  left: [string, number][]
  right: [string, number][]
} {
  return {
    left: equation.left.map((stack) => [stack.item.id, stack.count]),
    right: equation.right.map((stack) => [stack.item.id, stack.count]),
  }
}

function getScaleItemIdentifiers(puzzle: ScalePuzzle): Set<string> {
  const scaleItemIdentifiers = new Set(puzzle.placed.map((item) => item.id))
  if (puzzle.correctOptionId) {
    scaleItemIdentifiers.add(puzzle.correctOptionId)
  }

  return scaleItemIdentifiers
}

function hasAnswerAlreadyPlaced(puzzle: ScalePuzzle): boolean {
  return puzzle.placed.some((item) => item.id === puzzle.correctOptionId)
}

function getRequiredCorrectOptionId(puzzle: ScalePuzzle): string {
  if (!puzzle.correctOptionId) {
    assert.fail(`Generated puzzle "${puzzle.id}" should have a correct option`)
  }

  return puzzle.correctOptionId
}

function allScaleSlotsUseGeneratedDistance(puzzle: ScalePuzzle): boolean {
  return [...puzzle.placed.map((item) => item.slot), puzzle.addTo.slot].every((slot) => slot === 2)
}

function sortIdentifiers(identifiers: Iterable<string>): string[] {
  return [...identifiers].sort((first, second) => first.localeCompare(second))
}

function sortBooleanValues(values: Iterable<boolean>): boolean[] {
  return [...values].sort((first, second) => Number(first) - Number(second))
}

describe('generateScalePuzzle', () => {
  it('generates easy puzzles with exactly three scale item types and composite equations', () => {
    const puzzle = generateScalePuzzle({
      id: 'easy-variant-0',
      difficulty: EASY_SCALE_DIFFICULTY,
      itemPool: EASY_ITEM_POOL,
    })

    assert.equal(puzzle.equations.length, 2)
    assert.equal(puzzle.placed.length, 3)
    assert.equal(getScaleItemIdentifiers(puzzle).size, 3)
    assert.equal(allScaleSlotsUseGeneratedDistance(puzzle), true)
    assert.deepEqual(sortIdentifiers(getScaleItemIdentifiers(puzzle)), ['apple', 'ball', 'brick'])
    assert.notEqual(puzzle.correctOptionId, 'apple')
    assert.deepEqual(puzzle.equations.map(getEquationSummary), [
      {
        left: [['apple', 2]],
        right: [['ball', 1]],
      },
      {
        left: [['apple', 5]],
        right: [
          ['ball', 1],
          ['brick', 1],
        ],
      },
    ])
  })

  it('mixes missing and duplicate easy answers across all three item types', () => {
    const puzzles = [0, 1, 2, 3].map((index) =>
      generateScalePuzzle({
        id: `easy-variant-${index}`,
        difficulty: EASY_SCALE_DIFFICULTY,
        itemPool: EASY_ITEM_POOL,
      })
    )
    const correctOptionIdentifiers = new Set(puzzles.map(getRequiredCorrectOptionId))

    puzzles.forEach((puzzle) => {
      assert.equal(puzzle.placed.length, puzzle.options.length)
      assert.ok(getScaleItemIdentifiers(puzzle).size <= puzzle.options.length)
    })
    puzzles.slice(0, 2).forEach((puzzle) => {
      assert.equal(getScaleItemIdentifiers(puzzle).size, puzzle.options.length)
      assert.equal(hasAnswerAlreadyPlaced(puzzle), false)
    })
    puzzles.slice(2).forEach((puzzle) => {
      assert.equal(getScaleItemIdentifiers(puzzle).size, puzzle.options.length - 1)
      assert.equal(hasAnswerAlreadyPlaced(puzzle), true)
    })
    assert.deepEqual(sortIdentifiers(correctOptionIdentifiers), ['apple', 'ball', 'brick'])
    assert.deepEqual(sortBooleanValues(new Set(puzzles.map(hasAnswerAlreadyPlaced))), [false, true])
  })

  it('generates easy puzzles whose revealed answer balances the scale', () => {
    const puzzle = generateScalePuzzle({
      id: 'easy-balance-test-puzzle',
      difficulty: EASY_SCALE_DIFFICULTY,
      itemPool: EASY_ITEM_POOL,
    })
    const revealedItems = getDisplayedItems(puzzle, REVEAL_SCALE_PHASE)

    assert.equal(totalTorque(revealedItems), 0)
    assert.equal(angleForItems(revealedItems), 0)
  })

  it('generates hard puzzles with exactly four scale item types and composite equations', () => {
    const puzzle = generateScalePuzzle({
      id: 'hard-variant-0',
      difficulty: HARD_SCALE_DIFFICULTY,
      itemPool: HARD_ITEM_POOL,
    })

    assert.equal(puzzle.equations.length, 3)
    assert.equal(puzzle.placed.length, 4)
    assert.equal(getScaleItemIdentifiers(puzzle).size, 4)
    assert.equal(allScaleSlotsUseGeneratedDistance(puzzle), true)
    assert.deepEqual(sortIdentifiers(getScaleItemIdentifiers(puzzle)), [
      'apple',
      'ball',
      'brick',
      'vase',
    ])
    assert.equal(puzzle.correctOptionId, 'apple')
    assert.deepEqual(puzzle.equations.map(getEquationSummary), [
      {
        left: [['apple', 2]],
        right: [['ball', 1]],
      },
      {
        left: [['apple', 5]],
        right: [
          ['ball', 1],
          ['brick', 1],
        ],
      },
      {
        left: [['apple', 9]],
        right: [
          ['ball', 1],
          ['brick', 1],
          ['vase', 1],
        ],
      },
    ])
  })

  it('mixes missing and duplicate hard answers across all four item types', () => {
    const puzzles = [0, 1, 2, 3, 4, 5, 6, 7].map((index) =>
      generateScalePuzzle({
        id: `hard-variant-${index}`,
        difficulty: HARD_SCALE_DIFFICULTY,
        itemPool: HARD_ITEM_POOL,
      })
    )
    const correctOptionIdentifiers = new Set(puzzles.map(getRequiredCorrectOptionId))

    puzzles.forEach((puzzle) => {
      assert.equal(puzzle.placed.length, puzzle.options.length)
      assert.ok(getScaleItemIdentifiers(puzzle).size <= puzzle.options.length)
    })
    puzzles.slice(0, 4).forEach((puzzle) => {
      assert.equal(getScaleItemIdentifiers(puzzle).size, puzzle.options.length)
      assert.equal(hasAnswerAlreadyPlaced(puzzle), false)
    })
    puzzles.slice(4).forEach((puzzle) => {
      assert.equal(getScaleItemIdentifiers(puzzle).size, puzzle.options.length - 1)
      assert.equal(hasAnswerAlreadyPlaced(puzzle), true)
    })
    assert.deepEqual(sortIdentifiers(correctOptionIdentifiers), ['apple', 'ball', 'brick', 'vase'])
    assert.deepEqual(sortBooleanValues(new Set(puzzles.map(hasAnswerAlreadyPlaced))), [false, true])
  })

  it('generates every mock item pool without breaking the procedural rules', () => {
    SCALE_DIFFICULTIES.forEach((difficulty) => {
      SAMPLE_ITEM_POOLS[difficulty].forEach((itemPool, index) => {
        const puzzle = generateScalePuzzle({
          id: `${difficulty}-mock-pool-${index}`,
          difficulty,
          itemPool,
        })
        const revealedItems = getDisplayedItems(puzzle, REVEAL_SCALE_PHASE)

        assert.equal(totalTorque(revealedItems), 0)
        assert.equal(angleForItems(revealedItems), 0)
      })
    })
  })
})
