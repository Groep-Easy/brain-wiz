/**
 * @file game-events.ts
 * @description Internal, in-process domain events for the game's decoupled bus.
 * These NEVER cross the WebSocket — they only coordinate server-side services.
 */
import type { RoundType } from '@brain-wiz/shared/types/index'

/** An answer option as the presenter assigned it (the id↔correctness source of truth). */
export interface RoundOption {
  id: string
  text: string
  isCorrect: boolean
}

export type RoundScoringMode = 'quiz' | 'minigame'

export interface RoundWindowOpened {
  type: 'ROUND_WINDOW_OPENED'
  roomId: string
  roundId: string
  roundType: RoundType
  scoringMode: RoundScoringMode
  questionId?: string
  shownAt: number
  timeLimitSeconds: number
  basePoints?: number
  options?: RoundOption[]
  privateState?: Record<string, unknown>
  scoringConfig?: Record<string, unknown>
}

export interface AllPlayersAnswered {
  type: 'ALL_PLAYERS_ANSWERED'
  roomId: string
  roundId: string
}

export interface RoundWindowClosed {
  type: 'ROUND_WINDOW_CLOSED'
  roomId: string
  roundId: string
  reason: 'expired' | 'all-answered'
}

export interface RoundWindowFinalizeRequested {
  type: 'ROUND_WINDOW_FINALIZE_REQUESTED'
  roomId: string
  roundId: string
  reason: 'expired' | 'all-answered'
}

export interface RoundWindowFinalized {
  type: 'ROUND_WINDOW_FINALIZED'
  roomId: string
  roundId: string
}

export interface RoundScored {
  type: 'ROUND_SCORED'
  roomId: string
  roundId: string
}

/** The game was torn down (aborted/abandoned) while a round was in flight.
 * Consumers must drop any per-room window/scoring state WITHOUT scoring or
 * revealing — the engine has stopped waiting. Keyed by room only, since a torn
 * down game has no meaningful current round to finish. */
export interface RoundWindowAborted {
  type: 'ROUND_WINDOW_ABORTED'
  roomId: string
}

export type GameDomainEvent =
  | RoundWindowOpened
  | AllPlayersAnswered
  | RoundWindowFinalizeRequested
  | RoundWindowFinalized
  | RoundWindowClosed
  | RoundScored
  | RoundWindowAborted
