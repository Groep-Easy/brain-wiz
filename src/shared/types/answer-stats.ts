/**
 * @file answer-stats.ts
 * @description View-model types for the host question-reveal stats, derived by
 * `computeAnswerStats`. Type-only — no React, no DOM.
 */

export interface AnswerStat {
  id: string
  text: string
  count: number
  correct: boolean
  fraction: number
}

export interface AnswerStatsResult {
  stats: AnswerStat[]
  totalAnswered: number
  correctPlayers: number
}

export interface AnswerTally {
  counts: Map<string, number>
  totalAnswered: number
  correctPlayers: number
}
