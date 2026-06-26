import type { VaultRushPuzzle } from '@brain-wiz/minigames/vault-rush/shared/vaultRushGame'

export interface VaultRushProps {
  puzzle: VaultRushPuzzle
  readOnly?: boolean
  solutionCode?: string | undefined
  submitted?: boolean
  secondsRemaining?: number | undefined
  onCodeChange?: (code: string) => void
  onSubmitCode?: (code: string) => void
}
