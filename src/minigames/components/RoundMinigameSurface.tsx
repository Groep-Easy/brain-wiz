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
import { VaultRush } from '../vault-rush/components/VaultRush.js'
import type { VaultRushPuzzle } from '../vault-rush/shared/vaultRushGame.js'
import { WordleMock } from '../wordleGame/mock/WordleGameMock.js'
import type { WordlePublicState, WordleSubmission } from '../wordleGame/shared/wordleGame.types.js'
import { DEFAULT_MAX_TRIES, DEFAULT_WORD_LENGTH } from './RoundMinigameSurface.constants.js'
import type { RoundMinigameSurfaceProps, SurfaceContext } from './RoundMinigameSurface.types.js'

export type {
  RoundMinigameSurfaceMode,
  RoundMinigameSurfacePhase,
  RoundMinigameSurfaceProps,
} from './RoundMinigameSurface.types.js'

/** Wrap a minigame's content in the standard surface section. */
function surfaceSection(ctx: SurfaceContext, children: React.ReactNode): React.JSX.Element {
  return (
    <section
      className={ctx.classes}
      data-round-id={ctx.content.roundId}
      data-round-type={ctx.content.type}
    >
      {children}
    </section>
  )
}

function renderBalanceScale(ctx: SurfaceContext): React.JSX.Element {
  const solution = ctx.reveal?.publicSolution as { correctOptionId?: string } | undefined
  const puzzle = {
    ...(ctx.content.publicState as ScalePuzzle),
    ...(solution?.correctOptionId ? { correctOptionId: solution.correctOptionId } : {}),
  }
  return surfaceSection(
    ctx,
    <>
      {ctx.showScaleEquations ? <ScaleEquationClues equations={puzzle.equations} /> : null}
      <BalanceScale
        phase={ctx.phase === 'reveal' ? REVEAL_SCALE_PHASE : ANSWERING_SCALE_PHASE}
        puzzle={puzzle}
      />
    </>
  )
}

function renderSlidingPuzzle(ctx: SurfaceContext): React.JSX.Element {
  const puzzle = ctx.content.publicState as SlidingPuzzlePuzzle
  const isReadOnly = ctx.mode === 'display'
  return surfaceSection(
    ctx,
    <SlidingPuzzle
      {...(!isReadOnly
        ? {
            onBoardChange: (board: SlidingPuzzleBoard) => {
              if (ctx.onSubmissionChange) ctx.onSubmissionChange({ board })
            },
          }
        : {})}
      puzzle={puzzle}
      readOnly={isReadOnly}
    />
  )
}

function renderVaultRush(ctx: SurfaceContext): React.JSX.Element {
  const puzzle = ctx.content.publicState as VaultRushPuzzle
  const solution = ctx.reveal?.publicSolution as { code?: string } | undefined
  const readOnly = ctx.mode === 'display' || ctx.phase === 'reveal'
  const solutionCode = ctx.phase === 'reveal' ? solution?.code : undefined
  return surfaceSection(
    ctx,
    <VaultRush
      {...(!readOnly
        ? {
            onCodeChange: (code: string) => {
              ctx.onSubmissionChange?.({ code })
            },
          }
        : {})}
      {...(solutionCode ? { solutionCode } : {})}
      {...(ctx.phase === 'playing' && ctx.secondsRemaining !== undefined
        ? { secondsRemaining: ctx.secondsRemaining }
        : {})}
      puzzle={puzzle}
      readOnly={readOnly}
    />
  )
}

function renderWordle(ctx: SurfaceContext): React.JSX.Element {
  const publicState = ctx.content.publicState as Partial<WordlePublicState>
  if (ctx.mode === 'display') {
    // Host display — show a static placeholder, no interaction needed.
    return surfaceSection(ctx, <div className="wordle-display-placeholder">Wordle in progress…</div>)
  }
  return surfaceSection(
    ctx,
    <WordleMock
      maxTries={publicState.maxTries ?? DEFAULT_MAX_TRIES}
      onGuess={(submission: WordleSubmission) => ctx.onSubmissionChange?.(submission)}
      onSubmit={(submission: WordleSubmission) => ctx.onSubmissionChange?.(submission)}
      roundId={ctx.content.roundId}
      submitted={ctx.submitted}
      wordLength={publicState.wordLength ?? DEFAULT_WORD_LENGTH}
    />
  )
}

function renderLightSwitch(ctx: SurfaceContext): React.JSX.Element {
  return surfaceSection(
    ctx,
    <div className="card">
      <h1>Turn all lights on!</h1>
    </div>
  )
}

const SURFACE_RENDERERS: Record<string, (ctx: SurfaceContext) => React.JSX.Element> = {
  'balance-scale': renderBalanceScale,
  'sliding-puzzle': renderSlidingPuzzle,
  'vault-rush': renderVaultRush,
  wordle: renderWordle,
  'light-switch': renderLightSwitch,
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
  submitted = false,
}: RoundMinigameSurfaceProps): React.JSX.Element | null {
  const classes = ['round-minigame-surface', className].filter(Boolean).join(' ')
  const ctx: SurfaceContext = {
    content,
    reveal,
    mode,
    phase,
    classes,
    showScaleEquations,
    secondsRemaining,
    onSubmissionChange,
    submitted,
  }
  const render = SURFACE_RENDERERS[content.type]
  return render ? render(ctx) : null
}
