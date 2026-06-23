import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SlidingPuzzleServerAdapter } from '../../src/server/room/game/minigames/sliding-puzzle.server'
import { SOLVED_BOARD } from '@brain-wiz/minigames/sliding-puzzle/shared/slidingPuzzleGame'

describe('SlidingPuzzleServerAdapter', () => {
  it('adds a speed bonus for solved boards through the server scoring path', () => {
    const adapter = new SlidingPuzzleServerAdapter()
    const scoringConfig = {
      pointsPerCorrectTile: 100,
      solveSpeedBonus: 300,
      timeLimitMs: 30000,
    }

    const result = adapter.scoreSubmission({ board: SOLVED_BOARD }, {}, scoringConfig, 10000)

    assert.equal(result.isCorrect, true)
    assert.equal(result.pointsAwarded, 1000)
    assert.deepEqual(result.breakdown, {
      correctTiles: 8,
      totalTiles: 8,
      solved: true,
      positionPoints: 800,
      speedBonus: 200,
      pointsAwarded: 1000,
    })
  })

  it('does not add a speed bonus for unfinished boards', () => {
    const adapter = new SlidingPuzzleServerAdapter()
    const scoringConfig = {
      pointsPerCorrectTile: 100,
      solveSpeedBonus: 300,
      timeLimitMs: 30000,
    }

    const result = adapter.scoreSubmission(
      { board: [1, 2, 3, 4, 5, 6, 0, 7, 8] },
      {},
      scoringConfig,
      10000
    )

    assert.equal(result.isCorrect, false)
    assert.equal(result.pointsAwarded, 600)
    assert.deepEqual(result.breakdown, {
      correctTiles: 6,
      totalTiles: 8,
      solved: false,
      positionPoints: 600,
      speedBonus: 0,
      pointsAwarded: 600,
    })
  })
})
