/**
 * @file answer-stats.ts
 * @description Pure derivation of the host reveal view-model from a question
 * and its QUESTION_REVEAL payload. No React, no DOM — unit-testable.
 */
import type { QuestionState, QuestionRevealPayload } from '../types/index'
import type { AnswerStat, AnswerStatsResult, AnswerTally } from '../types/answer-stats'

/** Tally per-answer pick counts and aggregate answered/correct totals. */
function tallyAnswers(question: QuestionState, reveal: QuestionRevealPayload): AnswerTally {
  const counts = new Map<string, number>()
  for (const answer of question.answers) {
    counts.set(answer.id, 0)
  }

  let totalAnswered = 0
  let correctPlayers = 0
  for (const r of Object.values(reveal.playerAnswers)) {
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

  return { counts, totalAnswered, correctPlayers }
}

export function computeAnswerStats(
  question: QuestionState,
  reveal: QuestionRevealPayload
): AnswerStatsResult {
  const { counts, totalAnswered, correctPlayers } = tallyAnswers(question, reveal)

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
