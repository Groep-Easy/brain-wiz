/**
 * @file types/room.ts
 * @description The room/lobby state broadcast to host and clients.
 */
import type { GameFlowItem } from './flow'
import type { GamePhase } from './game'
import type { Player } from './player'

export interface RoomState {
  code: string
  players: Player[]
  phase: GamePhase
  round: number
  gameFlow: GameFlowItem[]
}
