/**
 * @file lobby-service.ts
 * @owner server-squad
 * @description Lobby orchestrator. Owns the connect/join/leave/disconnect/
 * reconnect/start business rules by composing RoomService (DB), ClientService
 * (DB), ConnectionRegistry (live sockets) and RoomBroadcaster (wire I/O). The
 * REST controller and WS gateway are thin adapters over this service.
 */
import 'reflect-metadata'
import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { RoomService } from '../room.service.js'
import { ClientService } from '../../client/client.service.js'
import { ConnectionRegistry } from './connection-registry.js'
import { RoomBroadcaster } from './room-broadcaster.js'
import { toRoomState } from '../room.helpers.js'
import { Room } from '../../entities/room.entity.js'
import { Client } from '../../entities/client.entity.js'
import { RoomStatusEnum } from '../../entities/enums.js'
import * as EVENTS from '../../../shared/events/socket-events.js'
import { ROOM, PLAYER } from '../../../shared/constants/game-config.js'
import { isValidRoomCode } from '../../../shared/utils/room-code.js'
import { RoomNotFoundError } from '../room.errors.js'
import { NotEnoughPlayersError, InvalidHostTokenError } from './lobby.errors.js'
import type { ClientSocket, CreateRoomResult } from './lobby.types.js'
import type { RoomState } from '../../../shared/types/index.js'

@Injectable()
export class LobbyService {
  public constructor(
    private readonly rooms: RoomService,
    private readonly clients: ClientService,
    private readonly registry: ConnectionRegistry,
    private readonly broadcaster: RoomBroadcaster
  ) {}

  public async createRoom(): Promise<CreateRoomResult> {
    const room = await this.rooms.createRoom()
    const hostToken = randomUUID()
    this.registry.setHostToken(room.id, hostToken)
    return { code: room.joinCode, hostToken, roomId: room.id }
  }

  /** Register a read-only host subscriber after verifying its token. */
  public async connectHost(
    code: string,
    hostToken: string,
    connectionId: string,
    socket: ClientSocket
  ): Promise<boolean> {
    const room = await this.rooms.findByJoinCode(code)
    if (!room || !this.registry.verifyHostToken(room.id, hostToken)) {
      return false
    }
    this.registry.registerHost(room.id, socket)
    await this.rooms.updateHostSocket(room, connectionId)
    const state = await this.buildState(room)
    this.broadcaster.emitToSocket(socket, EVENTS.ROOM_STATE_UPDATE, { room: state })
    return true
  }

  /** True when a live socket has already authenticated as a host or client. */
  public isConnectionRegistered(socket: ClientSocket): boolean {
    return this.registry.lookup(socket) !== undefined
  }

  /** Handle a PLAYER_JOIN: fresh join or reconnect (when playerId is supplied). */
  public async joinClient(
    socket: ClientSocket,
    connectionId: string,
    roomCode: string,
    playerName: string,
    playerId?: string,
    playerToken?: string
  ): Promise<void> {
    if (!isValidRoomCode(roomCode)) {
      this.reject(socket, 'Invalid room code')
      return
    }
    const displayName = playerName.trim()
    if (
      displayName.length < PLAYER.NAME_MIN_LENGTH ||
      displayName.length > PLAYER.NAME_MAX_LENGTH
    ) {
      this.reject(
        socket,
        `Display name must be ${PLAYER.NAME_MIN_LENGTH}–${PLAYER.NAME_MAX_LENGTH} characters`
      )
      return
    }

    const room = await this.rooms.findByJoinCode(roomCode)
    if (!room) {
      this.reject(socket, 'Room not found')
      return
    }
    if (room.status !== RoomStatusEnum.LOBBY) {
      this.reject(socket, 'Game already started')
      return
    }

    if (playerId) {
      const existing = await this.clients.findById(playerId)
      if (existing && existing.roomId === room.id) {
        if (!this.registry.verifyReconnectToken(playerId, playerToken)) {
          this.reject(socket, 'Invalid reconnect token')
          return
        }
        await this.reconnect(room, existing, connectionId, socket)
        return
      }
    }

    const roster = await this.clients.findByRoom(room.id)
    if (roster.length >= ROOM.MAX_PLAYERS) {
      this.reject(socket, 'Room is full')
      return
    }
    if (roster.some((c) => c.displayName === displayName)) {
      this.reject(socket, 'Display name is taken')
      return
    }

    const client = await this.clients.addClient(room.id, displayName, connectionId)
    const reconnectToken = randomUUID()
    this.registry.setReconnectToken(client.id, reconnectToken)
    this.registry.registerClient(room.id, client.id, socket)
    this.broadcaster.emitToSocket(socket, EVENTS.PLAYER_JOIN_ACK, {
      playerId: client.id,
      roomCode: room.joinCode,
      reconnectToken,
    })
    await this.broadcastState(room)
  }

  /** Explicit PLAYER_LEAVE: remove the client and refresh the room. */
  public async leaveClient(socket: ClientSocket): Promise<void> {
    const membership = this.registry.lookup(socket)
    if (!membership || membership.role !== 'client') {
      return
    }
    this.registry.unregister(socket)
    this.registry.clearReconnectToken(membership.clientId)
    const client = await this.clients.findById(membership.clientId)
    if (client) {
      await this.clients.remove(client)
    }
    const room = await this.rooms.findById(membership.roomId)
    if (room) {
      await this.broadcastState(room)
    }
    this.maybeTeardownRoom(membership.roomId)
  }

  /** Unexpected socket drop: arm the reconnect grace window. */
  public async handleDisconnect(socket: ClientSocket): Promise<void> {
    const membership = this.registry.lookup(socket)
    if (!membership) {
      return
    }
    this.registry.unregister(socket)

    if (membership.role === 'host') {
      const room = await this.rooms.findById(membership.roomId)
      if (room) {
        await this.rooms.updateHostSocket(room, null)
      }
      this.maybeTeardownRoom(membership.roomId)
      return
    }

    const client = await this.clients.findById(membership.clientId)
    if (!client) {
      return
    }
    await this.clients.setConnected(client, false)
    const room = await this.rooms.findById(membership.roomId)
    if (room) {
      this.broadcaster.emitToRoom(room.id, EVENTS.PLAYER_DISCONNECTED, { playerId: client.id })
      await this.broadcastState(room)
    }
    const timer = setTimeout(() => {
      void this.expireGrace(client.id)
    }, ROOM.RECONNECT_GRACE_MS)
    timer.unref()
    this.registry.setGraceTimer(client.id, timer)
  }

  /** Grace window elapsed: remove the client if it never came back. */
  public async expireGrace(clientId: string): Promise<void> {
    const timer = this.registry.clearGraceTimer(clientId)
    if (timer) {
      clearTimeout(timer)
    }
    const client = await this.clients.findById(clientId)
    if (!client || client.isConnected) {
      return
    }
    const roomId = client.roomId
    this.registry.clearReconnectToken(clientId)
    await this.clients.remove(client)
    const room = await this.rooms.findById(roomId)
    if (room) {
      await this.broadcastState(room)
    }
    this.maybeTeardownRoom(roomId)
  }

  public hasPendingRemoval(clientId: string): boolean {
    return this.registry.hasGraceTimer(clientId)
  }

  /**
   * When a room has no live sockets left (everyone has left/expired and the
   * host is gone), drop its in-memory host token so the registry's maps don't
   * grow unbounded as rooms come and go.
   */
  private maybeTeardownRoom(roomId: string): void {
    if (this.registry.getRoomSockets(roomId).length === 0) {
      this.registry.clearHostToken(roomId)
    }
  }

  public async startGame(code: string, hostToken: string): Promise<RoomState> {
    const room = await this.rooms.findByJoinCode(code)
    if (!room) {
      throw new RoomNotFoundError()
    }
    if (!this.registry.verifyHostToken(room.id, hostToken)) {
      throw new InvalidHostTokenError()
    }
    const roster = await this.clients.findByRoom(room.id)
    const connected = roster.filter((c) => c.isConnected).length
    if (connected < ROOM.MIN_PLAYERS_TO_START) {
      throw new NotEnoughPlayersError()
    }
    const started = await this.rooms.startRoom(room)
    this.broadcaster.emitToRoom(started.id, EVENTS.GAME_START)
    const state = await this.buildState(started)
    this.broadcaster.broadcastRoomState(started.id, state)
    return state
  }

  public async getRoomState(code: string): Promise<RoomState | null> {
    const room = await this.rooms.findByJoinCode(code)
    if (!room) {
      return null
    }
    return this.buildState(room)
  }

  private async reconnect(
    room: Room,
    client: Client,
    connectionId: string,
    socket: ClientSocket
  ): Promise<void> {
    const timer = this.registry.clearGraceTimer(client.id)
    if (timer) {
      clearTimeout(timer)
    }
    await this.clients.updateSocket(client, connectionId)
    // Rotate the reconnect secret so a previously-seen token can't be replayed.
    const reconnectToken = randomUUID()
    this.registry.setReconnectToken(client.id, reconnectToken)
    this.registry.registerClient(room.id, client.id, socket)
    this.broadcaster.emitToSocket(socket, EVENTS.PLAYER_JOIN_ACK, {
      playerId: client.id,
      roomCode: room.joinCode,
      reconnectToken,
    })
    this.broadcaster.emitToRoom(room.id, EVENTS.PLAYER_RECONNECTED, { playerId: client.id })
    await this.broadcastState(room)
  }

  private async buildState(room: Room): Promise<RoomState> {
    const roster = await this.clients.findByRoom(room.id)
    return toRoomState(room, roster)
  }

  private async broadcastState(room: Room): Promise<void> {
    const state = await this.buildState(room)
    this.broadcaster.broadcastRoomState(room.id, state)
  }

  private reject(socket: ClientSocket, reason: string): void {
    this.broadcaster.emitToSocket(socket, EVENTS.PLAYER_JOIN_REJECTED, { reason })
  }
}
