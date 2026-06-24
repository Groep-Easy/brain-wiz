/**
 * @file types/round.ts
 * @description The generic round/minigame lifecycle: round metadata, the broadcast
 * flow events, minigame content, submissions, progress/feedback, and reveal.
 */
import type { GamePhase, RoundType, ScoreMap } from './game'

/** Round metadata broadcast on ROUND_START. Not the question content.
 *  Named RoundSummary (not RoundState) to avoid confusion with RoomState. */
export interface RoundSummary {
  index: number
  total: number
  type: RoundType
  timeLimitSeconds: number
  questionText?: string
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

/** Server -> all: generic minigame content is live (ROUND_CONTENT_SHOW). */
export interface RoundAnswerChoice {
  id: string
  label: string
  emoji?: string
  submission: unknown
}

export interface RoundContentPayload {
  roundId: string
  type: RoundType
  seed?: string
  publicState: unknown
  answerChoices?: RoundAnswerChoice[]
  timeLimitSeconds: number
}

/** Client -> server: submit a procedural/minigame result (ROUND_SUBMIT). */
export interface RoundSubmitPayload {
  roundId: string
  type: RoundType
  submission: unknown
  timestamp?: number
}

/** Client -> server: latest procedural/minigame progress snapshot. */
export interface RoundProgressPayload {
  roundId: string
  type: RoundType
  submission: unknown
  timestamp?: number
}

/** Server -> client: feedback for an in-progress procedural/minigame attempt. */
export interface RoundFeedbackPayload {
  roundId: string
  type: RoundType
  feedback: unknown
}

export interface RoundPlayerResult {
  submission: unknown | null
  isCorrect: boolean
  pointsAwarded: number
  isTimeout: boolean
  breakdown?: unknown
}

/** Server -> all: generic minigame reveal + scoring (ROUND_REVEAL). */
export interface RoundRevealPayload {
  roundId: string
  type: RoundType
  playerResults: Record<string /* playerId */, RoundPlayerResult>
  publicSolution?: unknown
}
