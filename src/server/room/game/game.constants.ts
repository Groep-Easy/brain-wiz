/**
 * @file game.constants.ts
 * @owner server-squad
 * @description Constants for the game engine: the internal-to-wire phase map
 * and the leaderboard ranking sentinels.
 */
import type { GamePhase as WireGamePhase } from '@brain-wiz/shared/types/index'
import { GamePhase } from './game.types'

/** Maps the engine's internal sub-phase to the wire phase sent to clients. */
export const PHASE_TO_WIRE: Record<GamePhase, WireGamePhase> = {
  [GamePhase.INTRO]: 'round-intro',
  [GamePhase.QUESTION]: 'playing',
  [GamePhase.REVEAL]: 'reveal',
  [GamePhase.LEADERBOARD]: 'leaderboard',
  [GamePhase.GAME_OVER]: 'game-over',
}

export const FIRST_RANK = 1
export const NO_RANK_CHANGE = 0
export const NEW_PLAYER_POSITION = Number.MAX_SAFE_INTEGER
