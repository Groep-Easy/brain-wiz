/**
 * @file room.types.ts
 * @description Shapes consumed by the room → wire RoomState mappers.
 */
import { RoomStatusEnum } from '../entities/enums.js'

/** The room fields needed to build a wire `RoomState`. */
export interface RoomStateSource {
  joinCode: string
  status: RoomStatusEnum
  currentRoundIndex: number
}

/** The client fields needed to build a wire `Player`. */
export interface PlayerSource {
  id: string
  displayName: string
  isConnected: boolean
  totalScore: number
}
