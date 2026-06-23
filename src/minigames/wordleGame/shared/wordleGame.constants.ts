import words from 'an-array-of-english-words'

export const WORD_LENGTH = 5
export const MAX_TRIES = 6
export const ALPHABET = [...'QWERTYUIOPASDFGHJKLZXCVBNM'] as const
export type Letter = (typeof ALPHABET)[number]
export const FIVE_LETTER_WORDS = words.filter((w) => w.length === WORD_LENGTH)
