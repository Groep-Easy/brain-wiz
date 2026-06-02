/**
 * @file room-manager.ts
 * @owner server-squad
 * @description Manages all active game rooms in memory.
 * This is the authoritative state store — no other module holds room state.
 */
import 'reflect-metadata'
import { Injectable } from '@nestjs/common'
import { generateRoomCode } from '../../shared/utils/room-code.js'
import { ROOM } from '../../shared/constants/game-config.js'
import type { Player, RoomState } from '../../shared/types/index.js'

@Injectable()
export class RoomManager {
  private readonly _rooms = new Map<string, RoomState>()

  /**
   * Create a new room and return its code.
   */
  public createRoom(): string {
    let code: string
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

  public getRoom(code: string): RoomState | undefined {
    return this._rooms.get(code)
  }

  /**
   * Add a player to a room. Returns false if room full or not found.
   */
  public addPlayer(code: string, player: Player): boolean {
    const room = this._rooms.get(code)
    if (!room) {
      return false
    }
    if (room.players.length >= ROOM.MAX_PLAYERS) {
      return false
    }
    room.players.push(player)
    return true
  }

  /**
   * Remove a player by socket ID across all rooms.
   */
  public removePlayer(playerId: string): void {
    for (const room of this._rooms.values()) {
      room.players = room.players.filter((p) => p.id !== playerId)
    }
  }
}
