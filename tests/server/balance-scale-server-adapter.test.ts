import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { BalanceScaleServerAdapter } from '../../src/server/room/game/minigames/balance-scale.server'

describe('BalanceScaleServerAdapter', () => {
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
