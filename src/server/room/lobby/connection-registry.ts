/**
 * @file connection-registry.ts
 * @owner server-squad
 * @description In-memory registry of live WebSocket connections.
 *
 * The database is the source of truth for room/client *state*; this registry
 * holds the live socket objects (which cannot be persisted) so the server can
 * broadcast to a room. It also owns per-room host tokens and per-client
 * reconnect grace timers.
 */
import 'reflect-metadata'
import { Injectable } from '@nestjs/common'
import { safeEqual } from '../../socket/secure-compare.js'
import type { ClientSocket, Membership } from './lobby.types.js'

@Injectable()
export class ConnectionRegistry {
  private readonly _hosts = new Map<string, ClientSocket>()
  private readonly _clients = new Map<string, Map<string, ClientSocket>>()
  private readonly _membership = new Map<ClientSocket, Membership>()
  private readonly _hostTokens = new Map<string, string>()
  private readonly _reconnectTokens = new Map<string, string>()
  private readonly _graceTimers = new Map<string, NodeJS.Timeout>()

  public registerHost(roomId: string, socket: ClientSocket): void {
    const existing = this._hosts.get(roomId)
    if (existing && existing !== socket) {
      this._membership.delete(existing)
    }
    this._hosts.set(roomId, socket)
    this._membership.set(socket, { roomId, role: 'host' })
  }

  public registerClient(roomId: string, clientId: string, socket: ClientSocket): void {
    let room = this._clients.get(roomId)
    if (!room) {
      room = new Map<string, ClientSocket>()
      this._clients.set(roomId, room)
    }
    const previous = room.get(clientId)
    if (previous && previous !== socket) {
      this._membership.delete(previous)
    }
    room.set(clientId, socket)
    this._membership.set(socket, { roomId, role: 'client', clientId })
  }

  public getHostSocket(roomId: string): ClientSocket | undefined {
    return this._hosts.get(roomId)
  }

  public getClientSockets(roomId: string): ClientSocket[] {
    const room = this._clients.get(roomId)
    return room ? Array.from(room.values()) : []
  }

  public getRoomSockets(roomId: string): ClientSocket[] {
    const sockets = this.getClientSockets(roomId)
    const host = this._hosts.get(roomId)
    if (host) {
      sockets.push(host)
    }
    return sockets
  }

  public lookup(socket: ClientSocket): Membership | undefined {
    return this._membership.get(socket)
  }

  public unregister(socket: ClientSocket): Membership | undefined {
    const membership = this._membership.get(socket)
    if (!membership) {
      return undefined
    }
    this._membership.delete(socket)
    if (membership.role === 'host') {
      if (this._hosts.get(membership.roomId) === socket) {
        this._hosts.delete(membership.roomId)
      }
    } else {
      this._clients.get(membership.roomId)?.delete(membership.clientId)
    }
    return membership
  }

  public setHostToken(roomId: string, token: string): void {
    this._hostTokens.set(roomId, token)
  }

  public verifyHostToken(roomId: string, token: string): boolean {
    const expected = this._hostTokens.get(roomId)
    return expected !== undefined && safeEqual(expected, token)
  }

  /** Drop a room's host token (room torn down) to bound map growth. */
  public clearHostToken(roomId: string): void {
    this._hostTokens.delete(roomId)
  }

  public setReconnectToken(clientId: string, token: string): void {
    this._reconnectTokens.set(clientId, token)
  }

  public verifyReconnectToken(clientId: string, token: string | undefined): boolean {
    const expected = this._reconnectTokens.get(clientId)
    return expected !== undefined && token !== undefined && safeEqual(expected, token)
  }

  public clearReconnectToken(clientId: string): void {
    this._reconnectTokens.delete(clientId)
  }

  public setGraceTimer(clientId: string, timer: NodeJS.Timeout): void {
    this._graceTimers.set(clientId, timer)
  }

  public hasGraceTimer(clientId: string): boolean {
    return this._graceTimers.has(clientId)
  }

  public clearGraceTimer(clientId: string): NodeJS.Timeout | undefined {
    const timer = this._graceTimers.get(clientId)
    this._graceTimers.delete(clientId)
    return timer
  }
}
