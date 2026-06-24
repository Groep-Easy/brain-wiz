import type { Tile, Guess, GamePhase } from '../shared/wordleGame.types'

export interface WordleGameProps {
  guesses: Guess[]
  wordLength: number
  maxTries: number
  gamephase: GamePhase
  currentInput: string
  onKey: (key: string) => void
  onSubmit: () => void
  onDelete: () => void
  revealingRow: number | null
  showUnrealWord: boolean
  showShortWord: boolean
}
export interface KeyboardProps {
  onKey: (key: string) => void
  onSubmit: () => void
  onDelete: () => void
}

export interface KeyProps {
  label: Tile
  wide?: boolean
  onClick: () => void
}

export interface TileRowProps {
  tilerow: Guess | undefined
  currentInput: string
  wordLength: number
  isactive?: boolean
  isRevealing: boolean
}

export interface TileProps {
  tile: Tile
  index: number
  isRevealing: boolean
}
