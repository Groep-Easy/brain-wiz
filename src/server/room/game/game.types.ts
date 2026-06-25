/**
 * @file game.types.ts
 * @owner server-squad
 * @description Internal types for the game engine: phases, timer contract,
 * and the in-memory per-room running-game record.
 */

import type { Round } from '../../entities/round.entity'
import type { Client } from '../../entities/client.entity'
import type { ClientAnswer } from '../../entities/client-answer.entity'
import type { ClientSocket } from '../lobby/lobby.types'
import type { RoundOption, RoundScoringMode } from './game-events'
import type { RoundType } from '@brain-wiz/shared/types/index'

export type LeaderboardPlayer = Client

/** A round's internal sub-phase. Maps to the shared wire `GamePhase`. */
export enum GamePhase {
  INTRO = 'intro',
  QUESTION = 'question',
  REVEAL = 'reveal',
  LEADERBOARD = 'leaderboard',
  GAME_OVER = 'game-over',
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

/** Per-round scoring context, cached by the ScoringService while a round is open. */
export interface ScoringContext {
  roundId: string
  roundType: RoundType
  scoringMode: RoundScoringMode
  options: Map<string, RoundOption>
  timeLimitMs: number
  basePoints: number
  privateState?: Record<string, unknown>
  scoringConfig?: Record<string, unknown>
}

/** Everything a single round-scoring pass needs, gathered once by `scoreRound`. */
export interface RoundScoringJob {
  roomId: string
  roundId: string
  ctx: ScoringContext
  rows: ClientAnswer[]
  roster: Client[]
}

/** A single client's in-progress (not yet submitted) minigame snapshot. */
export interface RoundProgressSnapshot {
  answerValue: string
  timeToAnswerMs: number
}

/** The in-memory open answer window the AnswerService keeps per room. */
export interface OpenWindow {
  roundId: string
  roundType: RoundType
  scoringMode: RoundScoringMode
  shownAt: number
  options: Map<string, RoundOption>
  privateState?: Record<string, unknown>
  scoringConfig?: Record<string, unknown>
  submitted: Map<string, string>
  progress: Map<string, RoundProgressSnapshot>
}

/** A validated answer ready to be written to the database. */
export interface PersistSubmissionInput {
  socket: ClientSocket
  roomId: string
  clientId: string
  window: OpenWindow
  answerValue: string
}
