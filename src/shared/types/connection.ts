/**
 * @file types/connection.ts
 * @description Connection-lifecycle payloads: join handshake and liveness probe.
 */
import type { PlayerAvatar } from './player'

export interface PlayerJoinPayload {
  roomCode: string
  playerName: string
  playerAvatar: PlayerAvatar
  playerId?: string
  playerToken?: string
}

export interface PlayerJoinAckPayload {
  playerId: string
  roomCode: string
  reconnectToken: string
  playerAvatar: PlayerAvatar
}

export interface PlayerJoinRejectedPayload {
  reason: string
}

/** Client → server liveness probe (PING). */
export interface PingPayload {
  t: number
}

/** Server → client probe response (PONG). */
export interface PongPayload {
  t: number
  serverTime: number
}
