import type { RoundContentPayload, RoundRevealPayload } from '@brain-wiz/shared/types/index'
import { BalanceScale } from '../balance-scale/components/BalanceScale.js'
import { ScaleEquationClues } from '../balance-scale/components/ScaleEquationClues.js'
import {
  ANSWERING_SCALE_PHASE,
  REVEAL_SCALE_PHASE,
  type ScalePuzzle,
} from '../balance-scale/shared/scaleGame.js'
import { SlidingPuzzle } from '../sliding-puzzle/components/SlidingPuzzle.js'
import type {
  SlidingPuzzleBoard,
  SlidingPuzzlePuzzle,
} from '../sliding-puzzle/shared/slidingPuzzleGame.js'
import { VaultRush } from '@brain-wiz/minigames/vault-rush/components/VaultRush'
import type { VaultRushPuzzle } from '@brain-wiz/minigames/vault-rush/shared/vaultRushGame'

export type RoundMinigameSurfaceMode = 'play' | 'display'
export type RoundMinigameSurfacePhase = 'playing' | 'reveal'

export interface RoundMinigameSurfaceProps {
  content: RoundContentPayload
  reveal?: RoundRevealPayload | null
  mode?: RoundMinigameSurfaceMode
  phase?: RoundMinigameSurfacePhase
  className?: string
  showScaleEquations?: boolean
  secondsRemaining?: number
  onSubmissionChange?: (submission: unknown) => void
}

/**
 * Bare minigame renderer for host/client UI.
 * It renders the game itself from ROUND_CONTENT_SHOW, but it does not create
 * the surrounding screen, timer, answer buttons, or submit button.
 */
export function RoundMinigameSurface({
  content,
  reveal = null,
  mode = 'play',
  phase = 'playing',
  className,
  showScaleEquations = true,
  secondsRemaining,
  onSubmissionChange,
}: RoundMinigameSurfaceProps): React.JSX.Element | null {
  const classes = ['round-minigame-surface', className].filter(Boolean).join(' ')

  if (content.type === 'balance-scale') {
    const solution = reveal?.publicSolution as { correctOptionId?: string } | undefined
    const puzzle = {
      ...(content.publicState as ScalePuzzle),
      ...(solution?.correctOptionId ? { correctOptionId: solution.correctOptionId } : {}),
    }

    return (
      <section className={classes} data-round-id={content.roundId} data-round-type={content.type}>
        {showScaleEquations ? <ScaleEquationClues equations={puzzle.equations} /> : null}
        <BalanceScale
          phase={phase === 'reveal' ? REVEAL_SCALE_PHASE : ANSWERING_SCALE_PHASE}
          puzzle={puzzle}
        />
      </section>
    )
  }

  if (content.type === 'sliding-puzzle') {
    const puzzle = content.publicState as SlidingPuzzlePuzzle
    const isReadOnly = mode === 'display'

    return (
      <section className={classes} data-round-id={content.roundId} data-round-type={content.type}>
        <SlidingPuzzle
          {...(!isReadOnly
            ? {
                onBoardChange: (board: SlidingPuzzleBoard) => {
                  if (onSubmissionChange) onSubmissionChange({ board })
                },
              }
            : {})}
          puzzle={puzzle}
          readOnly={isReadOnly}
        />
      </section>
    )
  }

  if (content.type === 'vault-rush') {
    const puzzle = content.publicState as VaultRushPuzzle
    const solution = reveal?.publicSolution as { code?: string } | undefined
    const readOnly = mode === 'display' || phase === 'reveal'
    const solutionCode = phase === 'reveal' ? solution?.code : undefined

    return (
      <section className={classes} data-round-id={content.roundId} data-round-type={content.type}>
        <VaultRush
          {...(!readOnly
            ? {
                onCodeChange: (code: string) => {
                  onSubmissionChange?.({ code })
                },
              }
            : {})}
          {...(solutionCode ? { solutionCode } : {})}
          {...(phase === 'playing' && secondsRemaining !== undefined ? { secondsRemaining } : {})}
          puzzle={puzzle}
          readOnly={readOnly}
        />
      </section>
    )
  }

  return null
}
