/**
 * @file socket.constants.ts
 * @owner server-squad
 * @description Connection-level constants for the WebSocket gateway.
 */
import { WS_SUBPROTOCOL } from '../../shared/constants/ws'

/** Named sentinel to avoid magic-number lint errors when testing for missing query */
export const NO_QUERY_INDEX = -1

/** DI token for the allow-listed origins (mirrors the HTTP CORS allow-list). */
export const WS_ALLOWED_ORIGINS = 'WS_ALLOWED_ORIGINS'

/**
 * Subprotocol marker the host offers (alongside its token) on the
 * `Sec-WebSocket-Protocol` header. Re-exported from the shared constant so all
 * socket-side consumers resolve it from one place.
 */
export { WS_SUBPROTOCOL }

/** Close code and reason used when an invalid token transport is detected. */
export const INVALID_TOKEN_CLOSE_CODE = 4001
export const INVALID_TOKEN_CLOSE_REASON = 'Unauthorized: invalid token transport'

/** Close code and reason used when room is not found or host token is invalid. */
export const ROOM_NOT_FOUND_CLOSE_CODE = 4004
export const ROOM_NOT_FOUND_CLOSE_REASON = 'Room not found or unauthorized'
