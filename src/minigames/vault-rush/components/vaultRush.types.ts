import type { VaultRushPuzzle } from '../shared/vaultRushGame.js'

export interface VaultRushProps {
  puzzle: VaultRushPuzzle
  readOnly?: boolean
  solutionCode?: string
  onCodeChange?: (code: string) => void
}
