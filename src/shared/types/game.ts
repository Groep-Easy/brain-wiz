/**
 * @file types/game.ts
 * @description Core game primitives shared across all contexts.
 */

export type GamePhase = 'lobby' | 'round-intro' | 'playing' | 'reveal' | 'leaderboard' | 'game-over'

export type RoundType =
  | 'quiz'
  | 'collab-puzzle'
  | 'head-to-head'
  | 'sliding-puzzle'
  | 'balance-scale'
  | 'vault-rush'
  | 'wordle'
  | 'light-switch'

/** playerId → cumulative score (running total at the time the map is sent) */
export type ScoreMap = Record<string, number>
