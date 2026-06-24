import type { RoundContentPayload, RoundRevealPayload } from '@brain-wiz/shared/types/index'

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
  submitted?: boolean
}

/** The resolved props one minigame renderer needs, shared by all renderers. */
export interface SurfaceContext {
  content: RoundContentPayload
  reveal: RoundRevealPayload | null
  mode: RoundMinigameSurfaceMode
  phase: RoundMinigameSurfacePhase
  classes: string
  showScaleEquations: boolean
  secondsRemaining: number | undefined
  onSubmissionChange: ((submission: unknown) => void) | undefined
  submitted: boolean
}
