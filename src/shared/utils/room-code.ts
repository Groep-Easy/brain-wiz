/**
 * @file room-code.ts
 * @owner git-master
 * @description Room code generation and validation.
 * Lives in shared/ because server generates codes and client validates input.
 */
import { ROOM } from '../constants/game-config'

/** No 0/O/1/I — visually ambiguous on small phone screens */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/**
 * Generate a random room code.
 */
export function generateRoomCode(): string {
  let code = ''
  for (let i = 0; i < ROOM.CODE_LENGTH; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)] ?? ''
  }
  return code
}

/**
 * Validate a room code string (case-insensitive).
 */
export function isValidRoomCode(code: unknown): boolean {
  if (typeof code !== 'string') {
    return false
  }
  const pattern = new RegExp(`^[${ALPHABET}]{${ROOM.CODE_LENGTH}}$`)
  return pattern.test(code.toUpperCase())
}
