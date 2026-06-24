import {
  createVaultRushRound,
  type VaultRushGeneratedRound,
} from '@brain-wiz/minigames/vault-rush/shared/vaultRushGame'

export function getSampleVaultRushRound(index: number): VaultRushGeneratedRound {
  return createVaultRushRound({
    id: `sample-vault-rush-${index}`,
    seed: `sample-vault-rush-seed-${index}`,
  })
}

export const sampleVaultRushRound: VaultRushGeneratedRound = getSampleVaultRushRound(0)
export const sampleVaultRushPuzzle = sampleVaultRushRound.puzzle
export const sampleVaultRushCode = sampleVaultRushRound.code
