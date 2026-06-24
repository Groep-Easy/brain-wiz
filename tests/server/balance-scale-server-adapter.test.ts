import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { BalanceScaleServerAdapter } from '../../src/server/room/game/minigames/balance-scale.server'

describe('BalanceScaleServerAdapter', () => {
  it('keeps the correct option out of public state', () => {
    const adapter = new BalanceScaleServerAdapter()

    const round = adapter.createRound({
      roundId: 'round-1',
      seed: 'seed',
      roundIndex: 0,
      timeLimitSeconds: 30,
    })

    assert.equal(Object.prototype.hasOwnProperty.call(round.publicState, 'correctOptionId'), false)
    assert.equal(typeof round.privateState.correctOptionId, 'string')
    assert.ok(
      round.publicState.options.some((option) => option.id === round.privateState.correctOptionId)
    )
  })

  it('reveals the correct option only from private state during scoring', () => {
    const adapter = new BalanceScaleServerAdapter()

    const result = adapter.scoreSubmission(
      { optionId: 'apple' },
      { correctOptionId: 'apple' },
      { basePoints: 700, solveSpeedBonus: 300, timeLimitMs: 30000 },
      10000
    )

    assert.equal(result.isCorrect, true)
    assert.deepEqual(result.publicSolution, { correctOptionId: 'apple' })
  })

  it('maps public item options to answer choices with submit payloads', () => {
    const adapter = new BalanceScaleServerAdapter()

    const choices = adapter.getAnswerChoices({
      options: [
        { id: 'apple', label: 'Apple', emoji: 'A', weight: 3 },
        { id: 'book', label: 'Book', emoji: 'B', weight: 5 },
      ],
    })

    assert.deepEqual(choices, [
      { id: 'apple', label: 'Apple', emoji: 'A', submission: { optionId: 'apple' } },
      { id: 'book', label: 'Book', emoji: 'B', submission: { optionId: 'book' } },
    ])
  })
})
