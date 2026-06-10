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

export type GamePhase = 'lobby' | 'round-intro' | 'reveal-question' | 'playing' | 'reveal' | 'leaderboard' | 'game-over'

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

/** playerId → cumulative score (running total at the time the map is sent) */
export type ScoreMap = Record<string, number>

/** Round metadata broadcast on ROUND_START. Not the question content.
 *  Named RoundSummary (not RoundState) to avoid confusion with RoomState. */
export interface RoundSummary {
  index: number
  total: number
  type: RoundType
  timeLimitSeconds: number
}

/** Server → all: round started (ROUND_START). */
export interface RoundStartPayload {
  round: RoundSummary
}

/** Server → all: phase changed (GAME_PHASE_CHANGE). */
export interface GamePhaseChangePayload {
  phase: GamePhase
}

/** Server → all: timer tick (TIMER_TICK). */
export interface TimerTickPayload {
  secondsRemaining: number
}

/** Server → all: round ended (ROUND_END). */
export interface RoundEndPayload {
  scores: ScoreMap
}

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

/** Server → all: game over (GAME_OVER). */
export interface GameOverPayload {
  finalScores: ScoreMap
}

/** Client → server liveness probe (PING). */
export interface PingPayload {
  t: number
}

/** Server → client probe response (PONG). */
export interface PongPayload {
  t: number
  serverTime: number
}

export interface PlayerJoinPayload {
  roomCode: string
  playerName: string
  playerId?: string
  playerToken?: string
}

export interface PlayerJoinAckPayload {
  playerId: string
  roomCode: string
  reconnectToken: string
}

export interface PlayerJoinRejectedPayload {
  reason: string
}

/** Server → all: question is live (QUESTION_SHOW). */
export interface QuestionShowPayload {
  question: QuestionState
}

/** Client → server: submit an answer (ANSWER_SUBMIT). */
export interface AnswerSubmitPayload {
  answerId: string
  /** Client clock when the answer was chosen. Advisory only — the server times
   *  answers from its own clock (anti-cheat), so this field is not used for
   *  scoring. */
  timestamp: number
}

/** Server → client: answer outcome (ANSWER_ACK). */
export interface AnswerAckPayload {
  received: true
  accepted: boolean
  reason?: 'window-closed' | 'invalid-answer' | 'already-answered' | 'server-error'
}

/** Server → all: how many connected players have answered (ANSWER_COUNT_UPDATE). */
export interface AnswerCountUpdatePayload {
  answered: number
  total: number
}

/** One player's result inside QUESTION_REVEAL.playerAnswers. */
export interface PlayerAnswerResult {
  answerId: string | null
  isCorrect: boolean
  pointsAwarded: number
  isTimeout: boolean
}

/** Server → all: reveal correctness + scoring (QUESTION_REVEAL). */
export interface QuestionRevealPayload {
  roundId: string
  correctAnswerIds: string[]
  playerAnswers: Record<string /* playerId */, PlayerAnswerResult>
}
