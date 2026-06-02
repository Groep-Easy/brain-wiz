/**
 * @file room-state.ts
 * @owner server-squad
 * @description Pure mappers from persisted rows to the shared wire `RoomState`.
 * Keeping this pure (no DB, no sockets) makes the wire shape trivially testable
 * and gives the broadcaster a single, consistent payload to send.
 */
import { RoomStatusEnum } from '../entities/enums.js'
import type { GamePhase, Player, RoomState } from '../../shared/types/index.js'
import type { RoomStateSource, PlayerSource } from './room.types.js'

/**
 * Map the persisted room status to the wire game phase. `active` becomes
 * `round-intro` because the game has started but no round is live yet (rounds
 * are a later feature).
 */
export function roomStatusToPhase(status: RoomStatusEnum): GamePhase {
  switch (status) {
    case RoomStatusEnum.LOBBY:
      return 'lobby'
    case RoomStatusEnum.ACTIVE:
      return 'round-intro'
    case RoomStatusEnum.FINISHED:
    case RoomStatusEnum.ABANDONED:
      return 'game-over'
  }
}

export function toRoomState(room: RoomStateSource, clients: PlayerSource[]): RoomState {
  const players: Player[] = clients.map((c) => ({
    id: c.id,
    name: c.displayName,
    connected: c.isConnected,
    score: c.totalScore,
  }))
  return {
    code: room.joinCode,
    players,
    phase: roomStatusToPhase(room.status),
    round: room.currentRoundIndex,
  }
}
