import type { VaultRushPuzzle } from '../shared/vaultRushGame.js'

export interface VaultRushProps {
  puzzle: VaultRushPuzzle
  readOnly?: boolean
  solutionCode?: string | undefined
  submitted?: boolean
  onCodeChange?: (code: string) => void
  onSubmitCode?: (code: string) => void
}
