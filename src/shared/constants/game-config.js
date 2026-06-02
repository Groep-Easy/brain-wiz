/**
 * @file game-config.js
 * @owner git-master
 * @description Immutable game configuration constants.
 *
 * RULES:
 *  1. No magic numbers anywhere in the codebase — everything lives here.
 *  2. All exports are Object.freeze — treat as read-only at runtime.
 *  3. Values that differ per environment belong in config/, not here.
 */

export const ROOM = Object.freeze({
  CODE_LENGTH: 4,
  MAX_PLAYERS: 12,
  MIN_PLAYERS_TO_START: 2,
  JOIN_TIMEOUT_MS: 30_000,
})

export const TIMER = Object.freeze({
  QUESTION_SECONDS: 30,
  REVEAL_SECONDS: 5,
  ROUND_INTRO_SECONDS: 3,
})

export const SCORING = Object.freeze({
  CORRECT_BASE: 100,
  /** Speed bonus: max awarded when answer submitted immediately */
  SPEED_BONUS_MAX: 50,
})

export const ROUNDS = Object.freeze({
  TYPES: ['quiz', 'collab-puzzle', 'head-to-head'],
  DEFAULT_SEQUENCE: ['quiz', 'collab-puzzle', 'quiz', 'head-to-head'],
})
