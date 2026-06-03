/**
 * @file socket.types.ts
 * @owner server-squad
 * @description Connection-level types for the WebSocket gateway: the live socket
 * tagged with our per-connection bookkeeping, the subset of the upgrade request
 * we inspect, and the parsed connect query params.
 */
import type { ClientSocket } from '../room/lobby/lobby.types.js'

/** A live socket tagged with the per-connection id we assign on connect. */
export interface IdentifiedSocket extends ClientSocket {
  connectionId?: string
  idleTimer?: NodeJS.Timeout
}

/** The subset of the WS upgrade request the gateway inspects. */
export interface UpgradeRequest {
  url?: string
  headers?: { origin?: string }
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
