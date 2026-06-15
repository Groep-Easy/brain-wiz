import {Tile, Guess, TileState, GamePhase} from "../shared/wordleGame.types"


export interface WordleGameProps{
  guesses: Guess[],
  answer: string,
  gamephase: GamePhase,
  currentInput: string,
  onKey: (key: string) => void
  onSubmit: () => void
  onDelete: () => void
}

export interface KeyboardProps{
  onKey: (key: string) => void
  onSubmit: () => void
  onDelete: () => void
}

export interface Keyprops{
  label: string
  wide?: boolean
  onClick: () => void
}

export interface TileRowProps{
  tilerow?: Guess,
  currentInput: string,
  wordLength: number,
  isactive?: boolean
}

export interface TileProps{
  tile: Tile
}
