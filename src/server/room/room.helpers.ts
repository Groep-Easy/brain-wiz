/**
 * @file room-state.ts
 * @owner server-squad
 * @description Pure mappers from persisted rows to the shared wire `RoomState`.
 * Keeping this pure (no DB, no sockets) makes the wire shape trivially testable
 * and gives the broadcaster a single, consistent payload to send.
 */
import { RoomStatusEnum } from '../entities/enums'
import { GamePhase, Player, RoomState, DEFAULT_PLAYER_AVATAR } from '@shared/types/index'
import type { RoomStateSource, PlayerSource } from './room.types'

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

export function toRoomState(
  room: RoomStateSource,
  clients: PlayerSource[],
  livePhase?: GamePhase
): RoomState {
  const players: Player[] = clients.map((c) => ({
    id: c.id,
    name: c.displayName,
    connected: c.isConnected,
    score: c.totalScore,
    playerAvatar: c.playerAvatar ?? DEFAULT_PLAYER_AVATAR,
  }))
  return {
    code: room.joinCode,
    players,
    phase: livePhase ?? roomStatusToPhase(room.status),
    round: room.currentRoundIndex,
    gameFlow: room.gameFlow ?? [],
  }
}
