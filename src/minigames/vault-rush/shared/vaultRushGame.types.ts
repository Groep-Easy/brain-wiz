export interface VaultRushClue {
  digitIndex: number
  text: string
}

export interface VaultRushPuzzle {
  id: string
  digitCount: number
  clues: VaultRushClue[]
}

export interface VaultRushGeneratedRound {
  puzzle: VaultRushPuzzle
  code: string
}

export interface VaultRushGenerationInput {
  id: string
  seed: string
}
