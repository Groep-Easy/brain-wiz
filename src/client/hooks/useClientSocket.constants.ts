/**
 * @file useClientSocket.constants.ts
 * @description Connection tuning constants for the client WebSocket hook: the
 * backend URL and the reconnect/connect timings.
 */
import { getBackendWsUrl } from '@brain-wiz/shared/utils/env'

export const BACKEND_WS_URL = getBackendWsUrl(import.meta.env.VITE_WS_URL)
export const MAX_RECONNECT_ATTEMPTS = 5
export const RECONNECT_DELAY_MS = 1500
export const CONNECT_DELAY_MS = 50
