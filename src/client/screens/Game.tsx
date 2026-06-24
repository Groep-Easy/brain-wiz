/**
 * @file Game.tsx
 * @owner client-squad
 * @description Sliding-puzzle minigame screen, served at /game. The puzzle now
 * ships as a first-class React component (src/minigames/sliding-puzzle), so this
 * screen simply renders its local mock harness instead of side-loading the old
 * standalone bundle.
 */
import { useState, type JSX } from 'react'
import { SlidingPuzzleMock } from '@brain-wiz/minigames/sliding-puzzle/mock/SlidingPuzzleMock'
import { VaultRushMock } from '@brain-wiz/minigames/vault-rush/mock/VaultRushMock'

type PreviewMinigame = 'sliding-puzzle' | 'vault-rush'

export function Game(): JSX.Element {
  const [selectedMinigame, setSelectedMinigame] = useState<PreviewMinigame>('vault-rush')

  return (
    <>
      <div className="minigame-preview-controls">
        <button
          onClick={() => {
            setSelectedMinigame('sliding-puzzle')
          }}
          type="button"
        >
          Sliding Puzzle
        </button>

        <button
          onClick={() => {
            setSelectedMinigame('vault-rush')
          }}
          type="button"
        >
          Vault Rush
        </button>
      </div>

      {selectedMinigame === 'sliding-puzzle' ? <SlidingPuzzleMock /> : <VaultRushMock />}
    </>
  )
}

