/**
 * @file seeded-random.ts
 * @description Small deterministic PRNG helper for procedural round generation.
 */

// The game seed is a readable string, like room + round + game type.
// FNV turns that string into one stable 32-bit number, so the random
// generator starts from the same place for everyone in the same room.
const FNV_OFFSET_BASIS = 0x811c9dc5
const FNV_PRIME = 0x01000193
const UINT32_MAX_PLUS_ONE = 0x100000000
// These belong to Mulberry32. They look like random numbers, but they are the
// fixed bit-mixing values that make the same seed always create the same order.
const MULBERRY32_INCREMENT = 0x6d2b79f5
const MULBERRY32_SHIFT_A = 15
const MULBERRY32_SHIFT_B = 7
const MULBERRY32_SHIFT_C = 14
const MULBERRY32_MASK_A = 1
const MULBERRY32_MASK_B = 61

/** Hash a string into a stable unsigned 32-bit seed. */
export function hashSeed(seed: string): number {
  let hash = FNV_OFFSET_BASIS
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, FNV_PRIME)
  }
  return hash >>> 0
}

/** Create a random function returning values in [0, 1). */
export function createSeededRandom(seed: string): () => number {
  let state = hashSeed(seed)

  return () => {
    state = (state + MULBERRY32_INCREMENT) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> MULBERRY32_SHIFT_A), value | MULBERRY32_MASK_A)
    value ^= value + Math.imul(value ^ (value >>> MULBERRY32_SHIFT_B), value | MULBERRY32_MASK_B)
    return ((value ^ (value >>> MULBERRY32_SHIFT_C)) >>> 0) / UINT32_MAX_PLUS_ONE
  }
}
