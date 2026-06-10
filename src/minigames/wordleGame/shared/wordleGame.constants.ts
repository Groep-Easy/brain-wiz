export const WORD_LENGTH = 5
export const MAX_TRIES = 100
export const ALPHABET = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"] as const
export type Letter = (typeof ALPHABET)[number]
