/**
 * @file game-config.ts
 * @owner git-master
 * @description Immutable game configuration constants.
 *
 * RULES:
 *  1. No magic numbers anywhere in the codebase — everything lives here.
 *  2. All exports are Object.freeze — treat as read-only at runtime.
 *  3. Values that differ per environment belong in config/, not here.
 */
import type { RoundType } from '../types/index'

export const ROOM = Object.freeze({
  CODE_LENGTH: 4,
  MAX_PLAYERS: 12,
  MIN_PLAYERS_TO_START: 2,
  JOIN_TIMEOUT_MS: 30_000,
  RECONNECT_GRACE_MS: 30_000,
})

export const RATE_LIMIT = Object.freeze({
  WINDOW_MS: 1_000,
  MAX_MESSAGES: 20,
})

export const PLAYER = Object.freeze({
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 24,
})

export const WS = Object.freeze({
  MAX_PAYLOAD_BYTES: 16_384,
  HEARTBEAT_INTERVAL_MS: 30_000,
})

export const HOST_AUTH = Object.freeze({
  MAX_FAILURES: 5,
  WINDOW_MS: 60_000,
  LOCKOUT_MS: 60_000,
})

export const TIMER = Object.freeze({
  QUESTION_SECONDS: 30,
  REVEAL_SECONDS: 5,
  ROUND_INTRO_SECONDS: 3,
  LEADERBOARD_SECONDS: 10,
  // Max time the engine waits for ScoringService to signal ROUND_SCORED before
  // proceeding anyway (fallback so a scoring failure can't hang the loop).
  SCORED_AWAIT_TIMEOUT_MS: 5_000,
})

export const SCORING = Object.freeze({
  CORRECT_BASE: 100,
  SPEED_BONUS_MAX: 50,
})

export const ROUNDS = Object.freeze({
  TYPES: ['quiz', 'collab-puzzle', 'head-to-head'] as readonly RoundType[],
  DEFAULT_SEQUENCE: ['quiz', 'collab-puzzle', 'quiz', 'head-to-head'] as readonly RoundType[],
  // Number of rounds the engine plays per game (quiz-only MVP). When the
  // theme/round-selection feature lands, this becomes derived per room.
  COUNT: 1,
})
