import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  SOLVED_BOARD,
  createScrambledBoard,
  createSlidingPuzzle,
  getLegalTileIndexes,
  isAdjacent,
  isSolvable,
  moveTile,
  solveBoard,
} from '../../../src/minigames/sliding-puzzle/shared/slidingPuzzleGame.js'

describe('slidingPuzzleGame', () => {
  it('only moves adjacent tiles', () => {
    const board = SOLVED_BOARD.slice()

    assert.equal(isAdjacent(7, 8), true)
    assert.deepEqual(moveTile(board, 7), [1, 2, 3, 4, 5, 6, 7, 0, 8])
    assert.deepEqual(moveTile(board, 0), board)
  })

  it('creates solvable scrambled boards', () => {
    const randomValues = [0.1, 0.7, 0.4, 0.2, 0.9]
    let randomIndex = 0
    const board = createScrambledBoard(12, () => {
      const value = randomValues[randomIndex % randomValues.length]
      randomIndex += 1
      return value ?? 0
    })

    assert.equal(isSolvable(board), true)
    assert.notDeepEqual(board, SOLVED_BOARD)
    assert.notEqual(getLegalTileIndexes(board).length, 0)
  })

  it('solves a simple board', () => {
    const solutionPath = solveBoard([1, 2, 3, 4, 5, 6, 7, 0, 8])

    assert.deepEqual(solutionPath, [SOLVED_BOARD])
  })

  it('generates a puzzle with an image reference', () => {
    const puzzle = createSlidingPuzzle({
      id: 'test-puzzle',
      image: {
        id: 'image-1',
        url: '/images/image-1.png',
        alt: 'Test image',
      },
      scrambleMoves: 12,
    })

    assert.equal(puzzle.id, 'test-puzzle')
    assert.equal(puzzle.image.id, 'image-1')
    assert.equal(isSolvable(puzzle.initialBoard), true)
  })
})
