/**
 * @file display-name.ts
 * @description Display-name validation shared by client and server.
 * Lives in shared/ because the client validates input live and the server
 * enforces the same rule on join (mirrors room-code.ts).
 *
 * The profanity list is a deliberately small, hand-maintained casual filter
 * (English + Dutch). It catches obvious cases, not a determined adversary.
 */

import { PLAYER_NAME_MIN_LENGTH, PLAYER_NAME_MAX_LENGTH } from '../constants/game-limits'

export type DisplayNameResult = { ok: true } | { ok: false; reason: string }

/** Exact-match (case-insensitive) reserved words. */
export const RESERVED_NAMES: readonly string[] = [
  'admin',
  'administrator',
  'host',
  'server',
  'system',
  'bot',
  'moderator',
  'mod',
  'everyone',
  'brainwiz',
]

/**
 * Common profanity / slurs, English + Dutch, with light repeat tolerance
 * (e.g. "kaaanker"). Casual filter only — intentionally not exhaustive.
 */
export const PROFANITY_PATTERNS: readonly RegExp[] = [
  // English
  /f+u+c+k/i,
  /sh+i+t/i,
  /b+i+t+c+h/i,
  /a+s+s+h+o+l+e/i,
  /d+i+c+k+h+e+a+d/i,
  /n+i+g+g+(e+r|a+)/i,
  // Dutch
  /k+a+n+k+e+r/i,
  /k+u+t/i,
  /l+u+l/i,
  /h+o+e+r/i,
  /m+o+n+g+o+o+l/i,
  /k+l+o+o+t+z+a+k/i,
  /t+e+r+i+n+g/i,
  /t+y+f+u+s/i,
  /t+h+u+i+s+h+o+e+r/i,
]

/**
 * Centralized rejection reason strings. Exported so the server and client
 * (and their tests) reference the same values, preventing cross-module drift.
 */
export const NAME_REJECTION = Object.freeze({
  length: `Display name must be ${PLAYER_NAME_MIN_LENGTH}–${PLAYER_NAME_MAX_LENGTH} characters`,
  reserved: 'That name is reserved',
  profane: 'Please choose a different name',
})

/**
 * Validate a candidate display name. Trims first, then checks length, then
 * reserved words, then profanity. Returns the first failure.
 */
export function validateDisplayName(name: string): DisplayNameResult {
  const trimmed = name.trim()

  if (trimmed.length < PLAYER_NAME_MIN_LENGTH || trimmed.length > PLAYER_NAME_MAX_LENGTH) {
    return { ok: false, reason: NAME_REJECTION.length }
  }

  const lowered = trimmed.toLowerCase()

  if (RESERVED_NAMES.includes(lowered)) {
    return { ok: false, reason: NAME_REJECTION.reserved }
  }

  if (PROFANITY_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return { ok: false, reason: NAME_REJECTION.profane }
  }

  return { ok: true }
}
