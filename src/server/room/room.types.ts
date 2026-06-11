/**
 * @file room.types.ts
 * @description Shapes consumed by the room → wire RoomState mappers, plus the
 * HTTP request bodies accepted by RoomsController.
 */
import { RoomStatusEnum } from '../entities/enums'
import type { GameFlowItem } from '../../shared/types/flow'

/** The room fields needed to build a wire `RoomState`. */
export interface RoomStateSource {
  joinCode: string
  status: RoomStatusEnum
  currentRoundIndex: number
  gameFlow?: GameFlowItem[]
}

/** The client fields needed to build a wire `Player`. */
export interface PlayerSource {
  id: string
  displayName: string
  isConnected: boolean
  totalScore: number
}

/** Body of `POST /rooms/:code/start`. */
export interface StartRoomBody {
  hostToken?: string
}

/** Body of `PUT /rooms/:code/flow`. */
export interface StoreFlowBody {
  hostToken?: string
  flow?: GameFlowItem[]
}

/** Body of `POST /rooms/:code/flow/randomize`. */
export interface RandomizeFlowBody {
  hostToken?: string
  size?: number
}
