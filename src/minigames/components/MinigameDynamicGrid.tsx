import { SlidingPuzzle } from '../sliding-puzzle/components/SlidingPuzzle'
import type {
  SlidingPuzzleBoard,
  SlidingPuzzlePuzzle,
} from '../sliding-puzzle/shared/slidingPuzzleGame'
import { VaultRush } from '@brain-wiz/minigames/vault-rush/components/VaultRush'
import type { VaultRushPuzzle } from '@brain-wiz/minigames/vault-rush/shared/vaultRushGame'
import { handleSlidingPuzzleBoardUpdate } from './slidingPuzzleAutoSubmit'
import { WordleMock } from '../wordleGame/mock/WordleGameMock'
import type {
  MinigameDynamicGridProps,
  SlidingPuzzleData,
  VaultRushData,
  WordleData,
} from './MinigameDynamicGrid.types'

export type { MinigameDynamicGridProps } from './MinigameDynamicGrid.types'

function isSlidingPuzzlePuzzle(value: unknown): value is SlidingPuzzlePuzzle {
  const testValue = value as SlidingPuzzlePuzzle
  return (
    typeof testValue.id === 'string' &&
    typeof testValue.image.id === 'string' &&
    typeof testValue.image.url === 'string' &&
    typeof testValue.image.alt === 'string' &&
    Array.isArray(testValue.initialBoard) &&
    testValue.initialBoard.every((tile) => typeof tile === 'number' && Number.isInteger(tile))
  )
}

function isVaultRushPuzzle(value: unknown): value is VaultRushPuzzle {
  const testValue = value as VaultRushPuzzle
  return (
    typeof testValue.id === 'string' &&
    Array.isArray(testValue.clues) &&
    testValue.clues.every(
      (clue) => typeof clue.digitIndex === 'number' && typeof clue.text === 'string'
    )
  )
}

function renderSlidingPuzzle(data: SlidingPuzzleData): React.JSX.Element | null {
  if (!isSlidingPuzzlePuzzle(data.puzzle)) {
    return null
  }
  const { puzzle, submitted, phase } = data
  const handleBoardChange = (board: SlidingPuzzleBoard): void => {
    handleSlidingPuzzleBoardUpdate({
      board,
      submitted,
      phase,
      onProgress: data.onProgress,
      onSubmit: data.onSubmit,
    })
  }

  return (
    <section className="client-minigame client-minigame--sliding">
      <SlidingPuzzle
        onBoardChange={handleBoardChange}
        puzzle={puzzle}
        readOnly={submitted || phase === 'reveal'}
      />
    </section>
  )
}

function renderVaultRush(data: VaultRushData): React.JSX.Element | null {
  if (!isVaultRushPuzzle(data.puzzle)) {
    return null
  }
  const { puzzle, submitted, phase } = data

  const vaultRushProps = {
    onSubmitCode: (code: string) => {
      data.onSubmit({ code })
    },
    puzzle,
    readOnly: submitted || phase === 'reveal',
    submitted,
    ...(phase === 'playing' && data.secondsRemaining !== undefined
      ? { secondsRemaining: data.secondsRemaining }
      : {}),
    ...(phase === 'reveal' && data.solutionCode ? { solutionCode: data.solutionCode } : {}),
  }

  return (
    <section className="client-minigame client-minigame--vault-rush">
      <VaultRush {...vaultRushProps} />
    </section>
  )
}

function renderWordle(data: WordleData): React.JSX.Element {
  return (
    <section className="client-minigame client-minigame--wordle">
      <WordleMock
        feedback={data.feedback}
        maxTries={data.publicState.maxTries}
        onGuess={data.onGuess}
        onSubmit={data.onSubmit}
        roundId={data.roundId}
        submitted={data.submitted || data.phase === 'reveal'}
        wordLength={data.publicState.wordLength}
      />
    </section>
  )
}

export function MinigameDynamicGrid(data: MinigameDynamicGridProps): React.JSX.Element | null {
  switch (data.type) {
    case 'sliding-puzzle':
      return renderSlidingPuzzle(data)
    case 'vault-rush':
      return renderVaultRush(data)
    case 'wordle':
      return renderWordle(data)
    case 'example':
      return <section></section>
    default:
      return null
  }
}
