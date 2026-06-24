/**
 * @file types/player.ts
 * @description A player and their avatar.
 */

export interface PlayerAvatar {
  bodyColor: string
  faceId: number
}

export const DEFAULT_PLAYER_AVATAR: PlayerAvatar = {
  bodyColor: '#ccb87b',
  faceId: 0,
}

export interface Player {
  id: string
  name: string
  connected: boolean
  score: number
  playerAvatar: PlayerAvatar
}
