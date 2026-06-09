/**
 * @file scoring-service.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ScoringService } from '../../src/server/room/game/scoring.service'
import { GameEventBus } from '../../src/server/room/game/game-event-bus'
import * as EVENTS from '../../src/shared/events/socket-events'
import type { QuestionRevealPayload, RoundRevealPayload } from '../../src/shared/types/index'

interface AnswerRow {
  clientId: string
  roundId: string
  answerValue: string
  timeToAnswerMs: number
  isCorrect?: boolean | null
  pointsAwarded?: number | null
}

function setup(
  rows: AnswerRow[],
  roster: Array<{ id: string; totalScore: number }>,
  minigames?: unknown
): {
  bus: GameEventBus
  emits: Array<{ event: string; data: unknown }>
  saved: AnswerRow[]
  scores: Record<string, number>
} {
  const bus = new GameEventBus()
  const emits: Array<{ event: string; data: unknown }> = []
  const saved: AnswerRow[] = []
  const scores: Record<string, number> = {}

  const broadcaster = {
    emitToRoom: (_r: string, event: string, data?: unknown): void =>
      void emits.push({ event, data }),
  }
  const answerRepo = {
    find: async (): Promise<AnswerRow[]> => rows,
    save: async (r: AnswerRow): Promise<AnswerRow> => {
      saved.push(r)
      return r
    },
  }
  const clientService = {
    findByRoom: async (): Promise<Array<{ id: string; totalScore: number }>> => roster,
    addScore: async (c: { id: string; totalScore: number }, delta: number): Promise<unknown> => {
      scores[c.id] = (scores[c.id] ?? 0) + delta
      return c
    },
  }

  new ScoringService(
    bus,
    broadcaster as never,
    answerRepo as never,
    clientService as never,
    minigames as never
  )
  return { bus, emits, saved, scores }
}

function openAndClose(bus: GameEventBus): void {
  bus.publish({
    type: 'ROUND_WINDOW_OPENED',
    roomId: 'room-1',
    roundId: 'round-1',
    roundType: 'quiz',
    scoringMode: 'quiz',
    questionId: 'q1',
    shownAt: 0,
    timeLimitSeconds: 30,
    basePoints: 1000,
    options: [
      { id: 'round-1:0', text: 'Paris', isCorrect: true },
      { id: 'round-1:1', text: 'Berlin', isCorrect: false },
    ],
  })
  bus.publish({
    type: 'ROUND_WINDOW_CLOSED',
    roomId: 'room-1',
    roundId: 'round-1',
    reason: 'expired',
  })
}

describe('ScoringService', () => {
  it('awards time-decayed points for a correct answer and 0 for a wrong one', async () => {
    const rows: AnswerRow[] = [
      { clientId: 'pA', roundId: 'round-1', answerValue: 'round-1:0', timeToAnswerMs: 0 }, // instant correct
      { clientId: 'pB', roundId: 'round-1', answerValue: 'round-1:1', timeToAnswerMs: 5000 }, // wrong
    ]
    const ctx = setup(rows, [
      { id: 'pA', totalScore: 0 },
      { id: 'pB', totalScore: 0 },
    ])
    openAndClose(ctx.bus)
    await new Promise<void>((r) => {
      setImmediate(r)
    })

    assert.equal(ctx.scores['pA'], 1000) // basePoints * (30000-0)/30000
    assert.equal(ctx.scores['pB'], undefined) // wrong → addScore not called
  })

  it('broadcasts QUESTION_REVEAL with correct ids, per-player results, and roster timeouts', async () => {
    const rows: AnswerRow[] = [
      { clientId: 'pA', roundId: 'round-1', answerValue: 'round-1:0', timeToAnswerMs: 15000 },
    ]
    const ctx = setup(rows, [
      { id: 'pA', totalScore: 0 },
      { id: 'pB', totalScore: 0 }, // never answered → timeout
    ])
    openAndClose(ctx.bus)
    await new Promise<void>((r) => {
      setImmediate(r)
    })

    const reveal = ctx.emits.find((e) => e.event === EVENTS.QUESTION_REVEAL)
    assert.ok(reveal)
    const data = reveal?.data as QuestionRevealPayload
    assert.deepEqual(data.correctAnswerIds, ['round-1:0'])
    assert.equal(data.playerAnswers['pA']?.isCorrect, true)
    assert.equal(data.playerAnswers['pA']?.pointsAwarded, 500) // 1000 * (30000-15000)/30000
    assert.equal(data.playerAnswers['pB']?.isTimeout, true)
    assert.equal(data.playerAnswers['pB']?.answerId, null)
  })

  it('publishes ROUND_SCORED after scoring', async () => {
    const ctx = setup([], [{ id: 'pA', totalScore: 0 }])
    const scored: unknown[] = []
    ctx.bus.on('ROUND_SCORED').subscribe((e) => scored.push(e))
    openAndClose(ctx.bus)
    await new Promise<void>((r) => {
      setImmediate(r)
    })
    assert.equal(scored.length, 1)
  })

  it('drops the context on ROUND_WINDOW_ABORTED and does not score or reveal', async () => {
    const rows: AnswerRow[] = [
      { clientId: 'pA', roundId: 'round-1', answerValue: 'round-1:0', timeToAnswerMs: 0 },
    ]
    const ctx = setup(rows, [{ id: 'pA', totalScore: 0 }])

    ctx.bus.publish({
      type: 'ROUND_WINDOW_OPENED',
      roomId: 'room-1',
      roundId: 'round-1',
      roundType: 'quiz',
      scoringMode: 'quiz',
      questionId: 'q1',
      shownAt: 0,
      timeLimitSeconds: 30,
      basePoints: 1000,
      options: [{ id: 'round-1:0', text: 'Paris', isCorrect: true }],
    })
    ctx.bus.publish({ type: 'ROUND_WINDOW_ABORTED', roomId: 'room-1' })
    // A late close for the aborted room must be a no-op (context already gone).
    ctx.bus.publish({
      type: 'ROUND_WINDOW_CLOSED',
      roomId: 'room-1',
      roundId: 'round-1',
      reason: 'expired',
    })
    await new Promise<void>((r) => {
      setImmediate(r)
    })

    assert.equal(
      ctx.emits.find((e) => e.event === EVENTS.QUESTION_REVEAL),
      undefined
    )
    assert.equal(ctx.scores['pA'], undefined)
  })

  it('scores procedural minigame submissions through the registry', async () => {
    const minigames = {
      get: (): unknown => ({
        scoreSubmission: (): unknown => ({
          isCorrect: true,
          pointsAwarded: 450,
          breakdown: { correctTiles: 4 },
          publicSolution: { board: [1, 2, 3, 4, 5, 6, 7, 8, 0] },
        }),
      }),
    }
    const ctx = setup(
      [
        {
          clientId: 'pA',
          roundId: 'round-1',
          answerValue: JSON.stringify({ board: [1, 2, 3, 4, 5, 6, 7, 8, 0] }),
          timeToAnswerMs: 1000,
        },
      ],
      [{ id: 'pA', totalScore: 0 }],
      minigames
    )

    ctx.bus.publish({
      type: 'ROUND_WINDOW_OPENED',
      roomId: 'room-1',
      roundId: 'round-1',
      roundType: 'sliding-puzzle',
      scoringMode: 'minigame',
      shownAt: 0,
      timeLimitSeconds: 30,
      privateState: { solutionBoard: [] },
      scoringConfig: { pointsPerCorrectTile: 100 },
    })
    ctx.bus.publish({
      type: 'ROUND_WINDOW_CLOSED',
      roomId: 'room-1',
      roundId: 'round-1',
      reason: 'expired',
    })
    await new Promise<void>((r) => {
      setImmediate(r)
    })

    assert.equal(ctx.scores['pA'], 450)
    const reveal = ctx.emits.find((e) => e.event === EVENTS.ROUND_REVEAL)
    assert.ok(reveal)
    const data = reveal?.data as RoundRevealPayload
    assert.equal(data.type, 'sliding-puzzle')
    assert.equal(data.playerResults['pA']?.pointsAwarded, 450)
    assert.deepEqual(data.playerResults['pA']?.breakdown, { correctTiles: 4 })
  })
})
