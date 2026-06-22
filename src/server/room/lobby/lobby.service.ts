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
import { RoomService } from '../room.service'
import { ClientService } from '../../client/client.service'
import { ConnectionRegistry } from './connection-registry'
import { RoomBroadcaster } from './room-broadcaster'
import { GameEngineService } from '../game/game-engine.service'
import { toRoomState } from '../room.helpers'
import { Room } from '../../entities/room.entity'
import { Client } from '../../entities/client.entity'
import { RoomStatusEnum } from '../../entities/enums'
import * as EVENTS from '@brain-wiz/shared/constants/socket-events.constants'
import { ROOM } from '@brain-wiz/config/game.config'
import { isValidRoomCode } from '@brain-wiz/shared/utils/room-code'
import { validateDisplayName } from '@brain-wiz/shared/utils/display-name'
import { RoomNotFoundError } from '../room.errors'
import { InvalidHostTokenError, NotEnoughPlayersError } from './lobby.errors'
import type { ClientSocket, CreateRoomResult } from './lobby.types'
import type { PlayerAvatar, RoomState } from '@brain-wiz/shared/types/index'
import type { GameFlowItem } from '@brain-wiz/shared/types/flow'
import { QuestionService } from '../../question/question.service.js'
import { FlowService } from '../../flow/flow.service.js'
import { BasicResponseDto } from '@brain-wiz/shared/dto/rest-api.dto'

@Injectable()
export class LobbyService {
  public constructor(
    private readonly rooms: RoomService,
    private readonly clients: ClientService,
    private readonly registry: ConnectionRegistry,
    private readonly broadcaster: RoomBroadcaster,
    private readonly gameEngine: GameEngineService,
    private readonly questionService: QuestionService,
    private readonly flow: FlowService
  ) {}

  public async createRoom(): Promise<CreateRoomResult> {
    const room = await this.rooms.createRoom()
    const hostToken = randomUUID()
    this.registry.setHostToken(room.id, hostToken)
    const flow = await this.flow.randomize()
    await this.rooms.setGameFlow(room, flow)
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
    this.broadcaster.syncSocketState(room.id, socket)
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
    playerToken?: string,
    playerAvatar?: PlayerAvatar
  ): Promise<void> {
    if (!isValidRoomCode(roomCode)) {
      this.reject(socket, 'Invalid room code')
      return
    }
    const displayName = playerName.trim()
    const nameResult = validateDisplayName(displayName)
    if (!nameResult.ok) {
      this.reject(socket, nameResult.reason)
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

    const client = await this.clients.addClient(room.id, displayName, connectionId, playerAvatar)
    const reconnectToken = randomUUID()
    this.registry.setReconnectToken(client.id, reconnectToken)
    this.registry.registerClient(room.id, client.id, socket)
    this.broadcaster.emitToSocket(socket, EVENTS.PLAYER_JOIN_ACK, {
      playerId: client.id,
      roomCode: room.joinCode,
      reconnectToken,
      playerAvatar: client.playerAvatar,
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
    await this.maybeAbortGame(membership.roomId)
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
      await this.maybeAbortGame(room.id)
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
    await this.maybeAbortGame(roomId)
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
      setTimeout(() => {
        if (this.registry.getRoomSockets(roomId).length === 0) {
          this.registry.clearHostToken(roomId)
          this.broadcaster.clearCache(roomId)
        }
      }, ROOM.RECONNECT_GRACE_MS).unref()
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
    void this.gameEngine.run(started.id)
    return state
  }

  /**
   * Store the host-built game flow on a room (one-shot, used to build rounds at
   * start). Verifies the host token and normalizes the flow so it is playable.
   * Returns the stored flow.
   */
  public async setRoomFlow(
    code: string,
    hostToken: string,
    flow: GameFlowItem[]
  ): Promise<GameFlowItem[]> {
    const room = await this.requireHostRoom(code, hostToken)
    const normalized = await this.flow.normalizeForStorage(flow)

    await this.rooms.setGameFlow(room, normalized)
    await this.broadcastState(room)
    return normalized
  }

  /**
   * Server-side randomize: build a guaranteed-playable flow from the catalog,
   * store it on the room, and return it. Verifies the host token.
   */
  public async randomizeRoomFlow(
    code: string,
    hostToken: string,
    size?: number
  ): Promise<GameFlowItem[]> {
    const room = await this.requireHostRoom(code, hostToken)
    const flow = await this.flow.randomize(size)
    await this.rooms.setGameFlow(room, flow)
    await this.broadcastState(room)
    return flow
  }

  /** Resolve a room by code and assert the caller holds its host token. */
  private async requireHostRoom(code: string, hostToken: string): Promise<Room> {
    const room = await this.rooms.findByJoinCode(code)
    if (!room) {
      throw new RoomNotFoundError()
    }
    if (!this.registry.verifyHostToken(room.id, hostToken)) {
      throw new InvalidHostTokenError()
    }
    return room
  }

  public async sendQuestionToRoom(hostSocket: ClientSocket): Promise<void> {
    const membership = this.registry.lookup(hostSocket)
    if (!membership || membership.role !== 'host') return

    const room = await this.rooms.findById(membership.roomId)
    if (!room) return

    const question = await this.questionService.getRandomQuestion(room.usedQuestionsIds)
    if (!question) return

    await this.rooms.appendUsedQuestionsId(membership.roomId, question.id)

    this.broadcaster.emitToRoom(membership.roomId, EVENTS.QUESTION_SHOW, {
      question: question.text,
    })
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
    this.broadcaster.syncSocketState(room.id, socket)
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

  /** Abort a running game once its last connected player is gone. */
  private async maybeAbortGame(roomId: string): Promise<void> {
    const room = await this.rooms.findById(roomId)
    if (!room || room.status !== RoomStatusEnum.ACTIVE) {
      return
    }
    const roster = await this.clients.findByRoom(roomId)
    const activeOrRecovering = roster.filter((c) => c.isConnected || this.registry.hasGraceTimer(c.id)).length
    if (activeOrRecovering === 0) {
      this.gameEngine.abort(roomId)
    }
  }
  public async kickPlayerByRoom({
    roomCode,
    playerId,
    hostToken,
  }: {
    roomCode: string
    playerId: string
    hostToken: string
  }): Promise<BasicResponseDto> {
    const room = await this.rooms.findByJoinCode(roomCode)

    if (!room) {
      return { success: false, reason: 'ROOM_NOT_FOUND' }
    }

    if (room.status != RoomStatusEnum.LOBBY)
      return { success: false, reason: 'ROOM_STATUS_NOT_IN_LOBBY' }

    if (!this.registry.verifyHostToken(room.id, hostToken)) {
      return { success: false, reason: `NOT_AUTHORIZED: ${hostToken}` }
    }

    const client = await this.clients.findById(playerId)

    if (!client || client.roomId !== room.id) {
      return { success: false, reason: 'PLAYER_NOT_FOUND' }
    }

    const socket = this.registry.getSocketByClientId(playerId)

    if (socket) {
      this.broadcaster.emitToSocket(socket, EVENTS.PLAYER_KICKED)

      socket.close?.()

      this.registry.unregister(socket)
    }

    this.registry.clearReconnectToken(playerId)

    const timer = this.registry.clearGraceTimer(playerId)
    if (timer) {
      clearTimeout(timer)
    }

    await this.clients.remove(client)

    await this.broadcastState(room)

    return { success: true }
  }
}
