import type { Letter } from "./wordleGame.constants.ts"

export type TileState = "empty" | "correct" | "wrong" | "present"

export type Tile = {
  state: TileState
  letter: Letter | ''
}

export type Guess = {
  word: Tile[]
}

export type GamePhase = "solved" | "playing" | "waiting" | "failed"

