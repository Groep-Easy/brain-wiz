/**
 * @file room-broadcaster.ts
 * @owner server-squad
 * @description The single place that knows the wire format. Pushes
 * `{ event, data }` JSON envelopes to individual sockets or to every socket in
 * a room, using the live sockets held by the ConnectionRegistry.
 */
import 'reflect-metadata'
import { Injectable, Logger } from '@nestjs/common'
import { ConnectionRegistry } from './connection-registry'
import type { ClientSocket } from './lobby.types'
import {
  ROOM_STATE_UPDATE,
  ROADMAP_UPDATE,
  GAME_PHASE_CHANGE,
  ROUND_START,
  QUESTION_SHOW,
  ROUND_CONTENT_SHOW,
  LEADERBOARD_SHOW,
  GAME_OVER,
  QUESTION_REVEAL,
  ROUND_REVEAL,
  TIMER_TICK
} from '@brain-wiz/shared/constants/socket-events.constants'
import type { RoadmapUpdate, RoomState } from '@brain-wiz/shared/types/index'

interface RoomCache {
  phaseChange?: unknown
  roundStart?: unknown
  roadmap?: unknown
  content?: { event: string; data: unknown }
  reveal?: { event: string; data: unknown }
  timerTick?: unknown
}

@Injectable()
export class RoomBroadcaster {
  private readonly logger = new Logger(RoomBroadcaster.name)
  private readonly _roomStateCache = new Map<string, RoomCache>()

  public constructor(private readonly registry: ConnectionRegistry) {}

  public emitToSocket(socket: ClientSocket, event: string, data?: unknown): void {
    this.safeSend(socket, JSON.stringify({ event, data }))
  }

  public emitToRoom(roomId: string, event: string, data?: unknown): void {
    const payload = JSON.stringify({ event, data })

    let cache = this._roomStateCache.get(roomId)
    if (!cache) {
      cache = {}
      this._roomStateCache.set(roomId, cache)
    }

    if (event === GAME_PHASE_CHANGE) {
      cache.phaseChange = data
      delete cache.content
      delete cache.reveal
      delete cache.timerTick
    } else if (event === ROUND_START) {
      cache.roundStart = data
    } else if (event === ROADMAP_UPDATE) {
      cache.roadmap = data
    } else if (
      event === QUESTION_SHOW ||
      event === ROUND_CONTENT_SHOW ||
      event === LEADERBOARD_SHOW ||
      event === GAME_OVER
    ) {
      cache.content = { event, data }
    } else if (event === QUESTION_REVEAL || event === ROUND_REVEAL) {
      cache.reveal = { event, data }
    } else if (event === TIMER_TICK) {
      cache.timerTick = data
    }

    for (const socket of this.registry.getRoomSockets(roomId)) {
      this.safeSend(socket, payload)
    }
  }

  public syncSocketState(roomId: string, socket: ClientSocket): void {
    const cache = this._roomStateCache.get(roomId)
    if (!cache) return

    if (cache.roundStart) this.emitToSocket(socket, ROUND_START, cache.roundStart)
    if (cache.roadmap) this.emitToSocket(socket, ROADMAP_UPDATE, cache.roadmap)
    if (cache.phaseChange) this.emitToSocket(socket, GAME_PHASE_CHANGE, cache.phaseChange)
    if (cache.content) this.emitToSocket(socket, cache.content.event, cache.content.data)
    if (cache.reveal) this.emitToSocket(socket, cache.reveal.event, cache.reveal.data)
    if (cache.timerTick) this.emitToSocket(socket, TIMER_TICK, cache.timerTick)
  }

  public clearCache(roomId: string): void {
    this._roomStateCache.delete(roomId)
  }

  /**
   * Send to one socket without letting a single dead/erroring socket abort the
   * caller (e.g. a whole room broadcast). On failure the socket is pruned from
   * the registry so it's not retried.
   */
  private safeSend(socket: ClientSocket, payload: string): void {
    try {
      socket.send(payload)
    } catch (error) {
      this.logger.warn(`Dropping unreachable socket: ${String(error)}`)
      this.registry.unregister(socket)
    }
  }

  public broadcastRoomState(roomId: string, state: RoomState): void {
    this.emitToRoom(roomId, ROOM_STATE_UPDATE, { room: state })
  }

  public broadcastRoadmap(roomId: string, payload: RoadmapUpdate): void {
    this.emitToRoom(roomId, ROADMAP_UPDATE, payload)
  }
}
