import { WORD_LENGTH } from "./wordleGame.constants"
import type { Guess, Tile } from "./wordleGame.types"
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



// to do
// is solved
// generate answer
