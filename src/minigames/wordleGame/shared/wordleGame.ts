import { WORD_LENGTH, MAX_TRIES, FIVE_LETTER_WORDS } from "./wordleGame.constants"
import type { Guess, Tile, GamePhase } from "./wordleGame.types"
import type { Letter } from "./wordleGame.constants"


// import { title } from "node:process"


export function valid_input(input: string): Boolean{
  if (input.length != WORD_LENGTH){
    return false
  }
  else{
    return true
  }

}

export function evaluate_guess(guess: string, answer: string): Guess{

  if (!valid_input(guess)){
    throw new Error(`Words must be ${WORD_LENGTH} letters long`)
  }

  if (!valid_input(answer)){
    throw new Error(`Answer must be ${WORD_LENGTH} letters long`)
  }

  const guess_tiles: Tile[] = []
  const remaining_letters = answer.split("")


  // check for correct tiles
  for (let i = 0; i < WORD_LENGTH; i++){

    const guess_letter = guess[i] as Letter
    const answer_letter = answer[i] as Letter

    if (guess_letter == answer_letter){
      guess_tiles[i] = {letter: guess_letter, state: 'correct'}
      remaining_letters.splice(remaining_letters.indexOf(answer_letter), 1)
    }
    else{
      guess_tiles[i] = {
        letter: guess_letter,
        state: 'empty'
      }
    }

  }

  // check for present tiles

  for (let i = 0; i < WORD_LENGTH; i++){

    const tile = guess_tiles[i] as Tile

    if (tile.state == 'correct'){continue}

    const index_remaining = remaining_letters.indexOf(tile.letter)

    if (index_remaining != -1){
      tile.state = 'present'
      remaining_letters.splice(index_remaining, 1)
    }
    else{
      tile.state = 'wrong'
    }
  }

  return {word: guess_tiles}
}


export function is_solved(guess: string, answer: string): Boolean{
  return guess == answer
}


function guess_to_string(guess: Guess): string {
  return guess.word.map(tile => tile.letter).join("")
}

export function get_game_state(guesses: Guess[], answer: string): GamePhase {
  if (guesses.length === 0) {
    return "waiting"
  }
  if (guesses.some(guess => is_solved(guess_to_string(guess), answer))) {
    return "solved"
  }
  if (guesses.length >= MAX_TRIES) {
    return "failed"
  }
  return "playing"
}


export function get_random_word(): string {
  const index = Math.floor(Math.random() * FIVE_LETTER_WORDS.length)
  return (FIVE_LETTER_WORDS[index] ?? "crane").toUpperCase() // crane is fallback
}

export function is_valid_word(word: string): boolean {
  return FIVE_LETTER_WORDS.includes(word.toLowerCase())
}

export function getAmountGuesses(guesses: Guess[]): number {
  return guesses.length
}

export function getAmountTime(startTime: Date, endTime: Date): number {
  return Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
}
