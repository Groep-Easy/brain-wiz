/**
 * @file round-presenter-impl.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { RoundPresenterImpl } from '../../src/server/room/game/round-presenter.impl'
import { GameEventBus } from '../../src/server/room/game/game-event-bus'
import * as EVENTS from '@brain-wiz/shared/constants/socket-events.constants'
import type { Round } from '../../src/server/entities/round.entity'
import type { QuestionShowPayload } from '@brain-wiz/shared/types/index'

interface Emit {
  roomId: string
  event: string
  data: unknown
}

function recorder(): { emits: Emit[]; emitToRoom: (r: string, e: string, d?: unknown) => void } {
  const emits: Emit[] = []
  return {
    emits,
    emitToRoom: (roomId, event, data): void => void emits.push({ roomId, event, data }),
  }
}

function fakeRound(): Round {
  return {
    id: 'round-1',
    timeLimitSeconds: 30,
    question: {
      id: 'q1',
      text: 'Capital of France?',
      correctAnswers: ['Paris'],
      wrongAnswers: ['Berlin'],
      basePoints: 1000,
    },
  } as unknown as Round
}

describe('RoundPresenterImpl', () => {
  it('emits QUESTION_SHOW with answer options carrying stable ids (no correctness leaked)', async () => {
    const rec = recorder()
    const bus = new GameEventBus()
    const presenter = new RoundPresenterImpl(rec as never, bus)

    await presenter.present('room-1', fakeRound())

    const show = rec.emits.find((e) => e.event === EVENTS.QUESTION_SHOW)
    assert.ok(show, 'QUESTION_SHOW emitted')
    const payload = show?.data as QuestionShowPayload
    assert.equal(payload.question.id, 'round-1')
    assert.equal(payload.question.text, 'Capital of France?')
    assert.equal(payload.question.timeLimit, 30)
    assert.equal(payload.question.answers.length, 2)
    const texts = payload.question.answers.map((a) => a.text).sort()
    assert.deepEqual(texts, ['Berlin', 'Paris'])
    for (const a of payload.question.answers) {
      assert.ok(a.id.startsWith('round-1:'))
      assert.equal('isCorrect' in (a as object), false, 'correctness must NOT be sent to clients')
    }
  })

  it('publishes ROUND_WINDOW_OPENED with the id->correctness map and basePoints', async () => {
    const rec = recorder()
    const bus = new GameEventBus()
    const presenter = new RoundPresenterImpl(rec as never, bus)

    const opened: unknown[] = []
    bus.on('ROUND_WINDOW_OPENED').subscribe((e) => opened.push(e))

    await presenter.present('room-1', fakeRound())

    assert.equal(opened.length, 1)
    const e = opened[0] as {
      roomId: string
      roundId: string
      roundType: string
      scoringMode: string
      questionId: string
      timeLimitSeconds: number
      basePoints: number
      options: { id: string; text: string; isCorrect: boolean }[]
    }
    assert.equal(e.roomId, 'room-1')
    assert.equal(e.roundId, 'round-1')
    assert.equal(e.roundType, 'quiz')
    assert.equal(e.scoringMode, 'quiz')
    assert.equal(e.questionId, 'q1')
    assert.equal(e.basePoints, 1000)
    assert.equal(e.timeLimitSeconds, 30)
    const paris = e.options.find((o) => o.text === 'Paris')
    const berlin = e.options.find((o) => o.text === 'Berlin')
    assert.equal(paris?.isCorrect, true)
    assert.equal(berlin?.isCorrect, false)
  })
})
