/**
 * @file answer-stats.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computeAnswerStats } from '@brain-wiz/shared/utils/answer-stats'
import type { QuestionState, QuestionRevealPayload } from '@brain-wiz/shared/types/index'

const QUESTION: QuestionState = {
  id: 'q1',
  text: 'Capital of France?',
  timeLimit: 20,
  answers: [
    { id: 'a', text: 'Paris' },
    { id: 'b', text: 'Rome' },
    { id: 'c', text: 'Madrid' },
    { id: 'd', text: 'Berlin' },
  ],
}

function reveal(playerAnswers: QuestionRevealPayload['playerAnswers']): QuestionRevealPayload {
  return { roundId: 'r1', correctAnswerIds: ['a'], playerAnswers }
}

describe('computeAnswerStats', () => {
  it('counts picks per answer, flags the correct one, and totals', () => {
    const result = computeAnswerStats(
      QUESTION,
      reveal({
        p1: { answerId: 'a', isCorrect: true, pointsAwarded: 850, isTimeout: false },
        p2: { answerId: 'a', isCorrect: true, pointsAwarded: 700, isTimeout: false },
        p3: { answerId: 'b', isCorrect: false, pointsAwarded: 0, isTimeout: false },
        p4: { answerId: null, isCorrect: false, pointsAwarded: 0, isTimeout: true },
      })
    )

    assert.equal(result.stats.length, 4)
    assert.deepEqual(
      result.stats.map((s) => s.count),
      [2, 1, 0, 0]
    )
    assert.deepEqual(
      result.stats.map((s) => s.correct),
      [true, false, false, false]
    )
    // bar fraction is count / maxCount
    assert.deepEqual(
      result.stats.map((s) => s.fraction),
      [1, 0.5, 0, 0]
    )
    assert.equal(result.totalAnswered, 3) // timeout (null) excluded
    assert.equal(result.correctPlayers, 2)
  })

  it('returns all-zero stats and zero totals when nobody answered', () => {
    const result = computeAnswerStats(QUESTION, reveal({}))
    assert.deepEqual(
      result.stats.map((s) => s.count),
      [0, 0, 0, 0]
    )
    assert.deepEqual(
      result.stats.map((s) => s.fraction),
      [0, 0, 0, 0]
    )
    assert.equal(result.totalAnswered, 0)
    assert.equal(result.correctPlayers, 0)
  })
})
