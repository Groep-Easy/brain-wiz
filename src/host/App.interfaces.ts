import type { RoomState } from '@brain-wiz/shared/types/index'

/** A room the host is actively connected to, with non-null identity. */
export interface ActiveRoom {
  code: string
  token: string
  room: RoomState
}
