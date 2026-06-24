import type { PlayerAvatar } from '@brain-wiz/shared/types/index'

/** Credentials persisted locally so a player can rejoin after a reload/reconnect. */
export interface SavedPlayer {
  roomCode: string
  playerName: string
  playerId: string
  reconnectToken: string
  playerAvatar: PlayerAvatar
}
