/**
 * @file useHostSocket.constants.ts
 * @description Connection constants for the host WebSocket hook: the backend URLs
 * and the connect delay.
 */
import { getBackendHttpUrl, getBackendWsUrl } from '@brain-wiz/shared/utils/env'

export const BACKEND_WS_URL = getBackendWsUrl(import.meta.env.VITE_WS_URL)
export const BACKEND_HTTP_URL = getBackendHttpUrl(BACKEND_WS_URL)
export const CONNECT_DELAY_MS = 50
