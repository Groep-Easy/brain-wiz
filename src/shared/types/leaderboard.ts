/**
 * @file types/leaderboard.ts
 * @description Leaderboard, roadmap, and game-over payloads.
 */
import type { ScoreMap } from './game'
import type { RoundSummary } from './round'

/** Server → all: leaderboard shown (LEADERBOARD_SHOW). */
export interface LeaderboardShowPayload {
  round: RoundSummary
  leaderboard: LeaderboardEntry[]
}

/** Sorted leaderboard entries for all players in the room */
export interface LeaderboardEntry {
  playerId: string
  name: string
  score: number
  rank: number
  previousRank: number | null
  rankChange: number
  connected: boolean
}

export interface RoadmapTheme {
  theme: string
  questionsInTheme: number
}

export interface RoadmapUpdate {
  playerPos: number
  totalQuestions: number
  themes: RoadmapTheme[]
}

/** Server → all: game over (GAME_OVER). */
export interface GameOverPayload {
  finalScores: ScoreMap
}
