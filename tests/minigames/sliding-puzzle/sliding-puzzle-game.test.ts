import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  SOLVED_BOARD,
  createScrambledBoard,
  createSlidingPuzzle,
  countCorrectTiles,
  getLegalTileIndexes,
  isAdjacent,
  isSolvable,
  moveTile,
  scoreSlidingPuzzleBoard,
  solveBoard,
} from '@brain-wiz/minigames/sliding-puzzle/shared/slidingPuzzleGame'

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

  it('uses the same initial board for the same seed', () => {
    const input = {
      id: 'seeded-puzzle',
      seed: 'room-1:round-1:sliding-puzzle',
      image: {
        id: 'image-1',
        url: '/images/image-1.png',
        alt: 'Test image',
      },
      scrambleMoves: 20,
    }

    assert.deepEqual(
      createSlidingPuzzle(input).initialBoard,
      createSlidingPuzzle(input).initialBoard
    )
  })

  it('scores correct tile positions and gives a speed bonus only when solved', () => {
    const partialBoard = [1, 2, 3, 4, 5, 6, 0, 7, 8]
    assert.equal(countCorrectTiles(partialBoard), 6)

    const partialScore = scoreSlidingPuzzleBoard(
      partialBoard,
      { pointsPerCorrectTile: 100, solveSpeedBonus: 300, timeLimitMs: 30000 },
      1000
    )
    assert.equal(partialScore.pointsAwarded, 600)
    assert.equal(partialScore.speedBonus, 0)

    const solvedScore = scoreSlidingPuzzleBoard(
      SOLVED_BOARD,
      { pointsPerCorrectTile: 100, solveSpeedBonus: 300, timeLimitMs: 30000 },
      0
    )
    assert.equal(solvedScore.pointsAwarded, 1100)
    assert.equal(solvedScore.speedBonus, 300)
  })
})
