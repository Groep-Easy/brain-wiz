import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { WordleServerAdapter } from '../../src/server/room/game/minigames/wordle.server'

const SCORING_CONFIG = {
  basePoints: 1000,
  pointsPerExtraGuess: 100,
  solveSpeedBonus: 300,
  timeLimitMs: 30000,
}

describe('WordleServerAdapter', () => {
  it('keeps the answer out of public state', () => {
    const adapter = new WordleServerAdapter()

    const round = adapter.createRound({
      roundId: 'round-1',
      seed: 'seed',
      roundIndex: 0,
      timeLimitSeconds: 30,
    })

    assert.equal(Object.prototype.hasOwnProperty.call(round.publicState, 'answer'), false)
    assert.equal(typeof round.privateState.answer, 'string')
    assert.deepEqual(round.publicState, { wordLength: 5, maxTries: 6 })
  })

  it('returns server-evaluated progress feedback without exposing the answer', () => {
    const adapter = new WordleServerAdapter()

    const feedback = adapter.getProgressFeedback?.(
      { guesses: ['SLATE', 'CRANE'] },
      { answer: 'CRANE' }
    )

    assert.equal(feedback?.phase, 'solved')
    assert.equal(feedback?.guesses.length, 2)
    assert.deepEqual(
      feedback?.guesses[1]?.word.map((tile) => tile.state),
      ['correct', 'correct', 'correct', 'correct', 'correct']
    )
    assert.equal(feedback ? Object.prototype.hasOwnProperty.call(feedback, 'answer') : true, false)
  })

  it('scores raw guessed words against the private answer', () => {
    const adapter = new WordleServerAdapter()

    const result = adapter.scoreSubmission(
      { guesses: ['CRANE'] },
      { answer: 'CRANE' },
      SCORING_CONFIG,
      10000
    )

    assert.equal(result.isCorrect, true)
    assert.equal(result.pointsAwarded, 1200)
    assert.deepEqual(result.breakdown, {
      guessCount: 1,
      guessDeduction: 0,
      timeBonus: 200,
    })
    assert.deepEqual(result.publicSolution, { answer: 'CRANE' })
  })

  it('deducts points for extra guesses while keeping validation server-side', () => {
    const adapter = new WordleServerAdapter()

    const result = adapter.scoreSubmission(
      { guesses: ['SLATE', 'CRANE'] },
      { answer: 'CRANE' },
      SCORING_CONFIG,
      10000
    )

    assert.equal(result.isCorrect, true)
    assert.equal(result.pointsAwarded, 1100)
    assert.deepEqual(result.breakdown, {
      guessCount: 2,
      guessDeduction: 100,
      timeBonus: 200,
    })
  })

  it('rejects client-evaluated tile rows as submissions', () => {
    const adapter = new WordleServerAdapter()
    const forgedGuess = {
      word: [
        { letter: 'S', state: 'correct' },
        { letter: 'L', state: 'correct' },
        { letter: 'A', state: 'correct' },
        { letter: 'T', state: 'correct' },
        { letter: 'E', state: 'correct' },
      ],
    }

    assert.equal(adapter.validateSubmission({ guesses: [forgedGuess] }), false)

    const result = adapter.scoreSubmission(
      { guesses: [forgedGuess] },
      { answer: 'CRANE' },
      SCORING_CONFIG,
      10000
    )

    assert.equal(result.isCorrect, false)
    assert.equal(result.pointsAwarded, 0)
  })

  it('rejects guesses that are not valid five-letter words', () => {
    const adapter = new WordleServerAdapter()

    assert.equal(adapter.validateSubmission({ guesses: ['ABCDE'] }), false)
    assert.equal(adapter.validateSubmission({ guesses: ['CRANE', 'TOO-LONG'] }), false)
    assert.equal(adapter.validateSubmission({ guesses: [] }), false)
  })
})
