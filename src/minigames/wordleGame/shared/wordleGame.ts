import { WORD_LENGTH, MAX_TRIES, FIVE_LETTER_WORDS } from './wordleGame.constants'
import type { Guess, Tile, GamePhase } from './wordleGame.types'
import type { Letter } from './wordleGame.constants'

const NOLETTERS = -1
const MILLISECONDS_PER_SECOND = 1000

export function valid_input(input: string): boolean {
  if (input.length != WORD_LENGTH) {
    return false
  } else {
    return true
  }
}

export function evaluate_guess(guess: string, answer: string): Guess {
  if (!valid_input(guess)) {
    throw new Error(`Words must be ${WORD_LENGTH} letters long`)
  }

  if (!valid_input(answer)) {
    throw new Error(`Answer must be ${WORD_LENGTH} letters long`)
  }

  const guessTiles: Tile[] = []
  const remainingLetters = answer.split('')

  // check for correct tiles
  for (let i = 0; i < WORD_LENGTH; i++) {
    const guessLetter = guess[i] as Letter
    const answerLetter = answer[i] as Letter

    if (guessLetter == answerLetter) {
      guessTiles[i] = { letter: guessLetter, state: 'correct' }
      remainingLetters.splice(remainingLetters.indexOf(answerLetter), 1)
    } else {
      guessTiles[i] = {
        letter: guessLetter,
        state: 'empty',
      }
    }
  }

  // check for present tiles

  for (let i = 0; i < WORD_LENGTH; i++) {
    const tile = guessTiles[i] as Tile

    if (tile.state == 'correct') {
      continue
    }

    const indexRemaining = remainingLetters.indexOf(tile.letter)

    if (indexRemaining != NOLETTERS) {
      tile.state = 'present'
      remainingLetters.splice(indexRemaining, 1)
    } else {
      tile.state = 'wrong'
    }
  }

  return { word: guessTiles }
}

export function is_solved(guess: string, answer: string): boolean {
  return guess == answer
}

function guess_to_string(guess: Guess): string {
  return guess.word.map((tile) => tile.letter).join('')
}

export function get_game_state(guesses: Guess[], answer: string): GamePhase {
  if (guesses.length === 0) {
    return 'waiting'
  }
  if (guesses.some((guess) => is_solved(guess_to_string(guess), answer))) {
    return 'solved'
  }
  if (guesses.length >= MAX_TRIES) {
    return 'failed'
  }
  return 'playing'
}

export function get_random_word(): string {
  const index = Math.floor(Math.random() * FIVE_LETTER_WORDS.length)
  return (FIVE_LETTER_WORDS[index] ?? 'crane').toUpperCase() // crane is fallback
}

export function is_valid_word(word: string): boolean {
  return FIVE_LETTER_WORDS.includes(word.toLowerCase())
}

export function getAmountGuesses(guesses: Guess[]): number {
  return guesses.length
}

export function getAmountTime(startTime: Date, endTime: Date): number {
  return Math.floor((endTime.getTime() - startTime.getTime()) / MILLISECONDS_PER_SECOND)
}
