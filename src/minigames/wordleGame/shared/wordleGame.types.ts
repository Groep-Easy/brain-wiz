import type { Letter } from './wordleGame.constants.ts'

export type TileState = 'empty' | 'correct' | 'wrong' | 'present'

export interface Tile {
  state: TileState
  letter: Letter | ''
}

export interface Guess {
  word: Tile[]
}

export interface WordleSubmission {
  guesses: string[]
}

export interface WordlePublicState {
  wordLength: number
  maxTries: number
}

export interface WordleFeedback {
  guesses: Guess[]
  phase: GamePhase
}

export type GamePhase = 'solved' | 'playing' | 'waiting' | 'failed'
