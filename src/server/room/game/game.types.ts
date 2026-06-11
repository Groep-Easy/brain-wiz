/**
 * @file game.types.ts
 * @owner server-squad
 * @description Internal types for the game engine: phases, timer contract,
 * and the in-memory per-room running-game record.
 */

import type { Round } from '../../entities/round.entity'
import type { RoundType } from '../../../shared/types/index'

/** A round's internal sub-phase. Maps to the shared wire `GamePhase`. */
export enum GamePhase {
  INTRO = 'intro',
  QUESTION = 'question',
  REVEAL = 'reveal',
  LEADERBOARD = 'leaderboard',
}

/** Why a PhaseTimer resolved. */
export enum TimerOutcome {
  EXPIRED = 'expired',
  ENDED_EARLY = 'ended_early',
  ABORTED = 'aborted',
}

export interface TimerOptions {
  onTick: (secondsRemaining: number) => void
}

export interface RoundPresenter {
  present(roomId: string, round: Round): Promise<void> | void
}

export interface ProceduralRoundSeedInput {
  roomId: string
  roundId: string
  type: RoundType
}

/**
 * One cancellable countdown. `start` resolves EXPIRED when the clock hits 0,
 * ENDED_EARLY when short-circuited (future "everyone answered" rule), or
 * ABORTED when the game is torn down.
 */
export interface PhaseTimerLike {
  start(seconds: number, opts: TimerOptions): Promise<TimerOutcome>
  endEarly(): void
  cancel(): void
}

/** In-memory record of a game currently being driven by the engine. */
export interface RunningGame {
  aborted: boolean
  timer: PhaseTimerLike
}
