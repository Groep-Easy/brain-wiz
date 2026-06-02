/**
 * @file types/index.ts
 * @owner git-master
 * @description Type definitions shared across all three runtime contexts.
 *
 * Type-only — zero runtime cost.
 * RULES:
 *  1. Every socket event payload must have a type here.
 *  2. Types only. No classes, no runtime objects.
 *  3. Keep types flat — nested shapes get their own type.
 */

export type GamePhase = 'lobby' | 'round-intro' | 'playing' | 'reveal' | 'leaderboard' | 'game-over'

export type RoundType = 'quiz' | 'collab-puzzle' | 'head-to-head'

export interface Player {
  /** Socket ID assigned by server */
  id: string
  /** Display name chosen at join */
  name: string
  /** Live connection state */
  connected: boolean
  /** Cumulative score */
  score: number
}

export interface RoomState {
  code: string
  players: Player[]
  phase: GamePhase
  /** 0-based index */
  round: number
}

export interface QuestionState {
  id: string
  text: string
  /** Pre-shuffled on server */
  answers: Answer[]
  /** Seconds allowed */
  timeLimit: number
}

export interface Answer {
  id: string
  text: string
}

/** playerId → score delta */
export type ScoreMap = Record<string, number>
