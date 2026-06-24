/**
 * @file socket.types.ts
 * @owner server-squad
 * @description Connection-level types for the WebSocket gateway: the live socket
 * tagged with our per-connection bookkeeping, the subset of the upgrade request
 * we inspect, and the parsed connect query params.
 */
import type { ClientSocket } from '../room/lobby/lobby.types'

/**
 * The `ws`-socket surface the heartbeat monitor uses. All optional so test
 * fakes (and the abstract ClientSocket) satisfy it; the real `ws` socket
 * provides them at runtime.
 */
export interface HeartbeatSocket {
  isAlive?: boolean
  ping?: () => void
  terminate?: () => void
  on?: (event: string, listener: () => void) => void
}

/** A live socket tagged with the per-connection id we assign on connect. */
export interface IdentifiedSocket extends ClientSocket, HeartbeatSocket {
  connectionId?: string
  idleTimer?: NodeJS.Timeout
}

/** A host's WebSocket connection attempt, gathered from the upgrade request. */
export interface HostConnectAttempt {
  code: string
  hostToken: string
  connectionId: string
  client: IdentifiedSocket
  ip: string
}

/** The subset of the WS upgrade request the gateway inspects. */
export interface UpgradeRequest {
  url?: string
  headers?: {
    origin?: string
    'sec-websocket-protocol'?: string
    'x-forwarded-for'?: string | string[]
  }
  socket?: { remoteAddress?: string }
}

/** One connection's fixed-window counter, held by the RateLimiter. */
export interface RateLimitWindow {
  windowStart: number
  count: number
}

/** Connection query params parsed from the WS upgrade URL. */
export interface ConnectParams {
  role?: string
  code?: string
  hostToken?: string
}

/** The record we keep per-IP in the HostAuthThrottle. */
export interface HostAuthRecord {
  failures: number
  firstFailureAt: number
  lockedUntil: number
}

/** A socket that supports close(code, reason) at runtime (ws). */
export type CloseableSocket = IdentifiedSocket & {
  close?: (code?: number, reason?: string) => void
}
