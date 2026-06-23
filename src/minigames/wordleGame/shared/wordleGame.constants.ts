import FIVE_LETTER_WORDS from './five-letter-words.json'
export const WORD_LENGTH = 5
export const MAX_TRIES = 6
export const ALPHABET = [...'QWERTYUIOPASDFGHJKLZXCVBNM'] as const
export type Letter = (typeof ALPHABET)[number]
export { FIVE_LETTER_WORDS }
