/**
 * @file lobby.types.ts
 * @description Shared types for the lobby: the minimal socket contract, the
 * in-memory membership union, and the create-room result.
 */
import type { PlayerAvatar } from '@brain-wiz/shared/types/index'

/** The subset of a `ws` socket the server needs to push messages. */
export interface ClientSocket {
  send(data: string): void
  close?(): void
}

export interface JoinClientRequest {
  connectionId: string
  roomCode: string
  playerName: string
  playerId?: string | undefined
  playerToken?: string | undefined
  playerAvatar?: PlayerAvatar | undefined
}

export type ConnectionRole = 'host' | 'client'

export interface HostMembership {
  roomId: string
  role: 'host'
}

export interface ClientMembership {
  roomId: string
  role: 'client'
  clientId: string
}

export type Membership = HostMembership | ClientMembership

export interface CreateRoomResult {
  code: string
  hostToken: string
  roomId: string
}
