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
import type { QuestionThemeEnum, DifficultyEnum } from '../../server/entities/enums.js'

export type GamePhase = 'lobby' | 'round-intro' | 'playing' | 'reveal' | 'leaderboard' | 'game-over'

export type RoundType = 'quiz' | 'collab-puzzle' | 'head-to-head'

export interface Player {
  id: string
  name: string
  connected: boolean
  score: number
}

export interface RoomState {
  code: string
  players: Player[]
  phase: GamePhase
  round: number
}

export interface QuestionState {
  id: string
  text: string
  answers: Answer[]
  timeLimit: number
}

export interface Answer {
  id: string
  text: string
}

/** playerId → score delta */
export type ScoreMap = Record<string, number>

/** Client → server liveness probe (PING). */
export interface PingPayload {
  t: number
}

/** Server → client probe response (PONG). */
export interface PongPayload {
  t: number
  serverTime: number
}

/** Client → server join request (PLAYER_JOIN). `playerId` echoes back to reconnect. */
export interface PlayerJoinPayload {
  roomCode: string
  playerName: string
  playerId?: string
}

export interface QuestionCreatePayload {
  text: string
  theme: QuestionThemeEnum
  difficulty: DifficultyEnum
  correctAnswers: string[]
  wrongAnswers: string[]
  imagePath?: string
  timeLimitSeconds?: number | null
  basePoints?: number
}

/** Server → client join accepted (PLAYER_JOIN_ACK). */
export interface PlayerJoinAckPayload {
  playerId: string
  roomCode: string
}

/** Server → client join rejected (PLAYER_JOIN_REJECTED). */
export interface PlayerJoinRejectedPayload {
  reason: string
}
