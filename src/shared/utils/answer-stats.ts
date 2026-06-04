/**
 * @file answer-stats.ts
 * @description Pure derivation of the host reveal view-model from a question
 * and its QUESTION_REVEAL payload. No React, no DOM — unit-testable.
 */
import type { QuestionState, QuestionRevealPayload } from '../types/index'

/** Per-answer reveal stat, in the question's answer order. */
export interface AnswerStat {
  id: string
  text: string
  count: number
  correct: boolean
  /** count / maxCount across answers; 0 when no answers. For bar widths. */
  fraction: number
}

export interface AnswerStatsResult {
  stats: AnswerStat[]
  /** players who submitted a non-null answer */
  totalAnswered: number
  /** players whose answer was correct */
  correctPlayers: number
}

export function computeAnswerStats(
  question: QuestionState,
  reveal: QuestionRevealPayload
): AnswerStatsResult {
  const results = Object.values(reveal.playerAnswers)

  const counts = new Map<string, number>()
  for (const answer of question.answers) {
    counts.set(answer.id, 0)
  }
  let totalAnswered = 0
  let correctPlayers = 0
  for (const r of results) {
    if (r.answerId !== null && counts.has(r.answerId)) {
      counts.set(r.answerId, (counts.get(r.answerId) ?? 0) + 1)
    }
    if (r.answerId !== null) {
      totalAnswered += 1
    }
    if (r.isCorrect) {
      correctPlayers += 1
    }
  }

  const maxCount = Math.max(0, ...counts.values())
  const correctSet = new Set(reveal.correctAnswerIds)

  const stats: AnswerStat[] = question.answers.map((answer) => {
    const count = counts.get(answer.id) ?? 0
    return {
      id: answer.id,
      text: answer.text,
      count,
      correct: correctSet.has(answer.id),
      fraction: maxCount === 0 ? 0 : count / maxCount,
    }
  })

  return { stats, totalAnswered, correctPlayers }
}
