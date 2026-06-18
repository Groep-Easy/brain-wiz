import type {
  RoundContentPayload,
  RoundRevealPayload,
} from '@brain-wiz/shared/types/index'
import { BalanceScale } from '../balance-scale/components/BalanceScale.js'
import { ScaleEquationClues } from '../balance-scale/components/ScaleEquationClues.js'
import {
  ANSWERING_SCALE_PHASE,
  REVEAL_SCALE_PHASE,
  type ScalePuzzle,
} from '../balance-scale/shared/scaleGame.js'
import { SlidingPuzzle } from '../sliding-puzzle/components/SlidingPuzzle.js'
import type { SlidingPuzzleBoard, SlidingPuzzlePuzzle } from '../sliding-puzzle/shared/slidingPuzzleGame.js'

export type RoundMinigameSurfaceMode = 'play' | 'display'
export type RoundMinigameSurfacePhase = 'playing' | 'reveal'

export interface RoundMinigameSurfaceProps {
  content: RoundContentPayload
  reveal?: RoundRevealPayload | null
  mode?: RoundMinigameSurfaceMode
  phase?: RoundMinigameSurfacePhase
  className?: string
  showScaleEquations?: boolean
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
          onBoardChange={
            isReadOnly ? undefined : (board: SlidingPuzzleBoard) => onSubmissionChange?.({ board })
          }
          puzzle={puzzle}
          readOnly={isReadOnly}
        />
      </section>
    )
  }

  return null
}
