/**
 * @file room-manager.js
 * @owner server-squad
 * @description Manages all active game rooms in memory.
 * This is the authoritative state store — no other module holds room state.
 */
import { generateRoomCode } from '../../shared/utils/room-code.js'
import { ROOM } from '../../shared/constants/game-config.js'

export class RoomManager {
  constructor() {
    /** @type {Map<string, import('../../shared/types/index.js').RoomState>} */
    this._rooms = new Map()
  }

  /**
   * Create a new room and return its code.
   * @returns {string} room code
   */
  createRoom() {
    let code
    do {
      code = generateRoomCode()
    } while (this._rooms.has(code))

    this._rooms.set(code, {
      code,
      players: [],
      phase: 'lobby',
      round: 0,
    })
    return code
  }

  /**
   * @param {string} code
   * @returns {import('../../shared/types/index.js').RoomState | undefined}
   */
  getRoom(code) {
    return this._rooms.get(code)
  }

  /**
   * Add a player to a room. Returns false if room full or not found.
   * @param {string} code
   * @param {import('../../shared/types/index.js').Player} player
   * @returns {boolean}
   */
  addPlayer(code, player) {
    const room = this._rooms.get(code)
    if (!room) { return false }
    if (room.players.length >= ROOM.MAX_PLAYERS) { return false }
    room.players.push(player)
    return true
  }

  /**
   * Remove a player by socket ID across all rooms.
   * @param {string} playerId
   */
  removePlayer(playerId) {
    for (const room of this._rooms.values()) {
      room.players = room.players.filter((p) => p.id !== playerId)
    }
  }
}
