/**
 * @file handshake.helper.ts
 * @owner server-squad
 * @description Helpers for the WebSocket upgrade handshake.
 *
 * The host passes its control token via the `Sec-WebSocket-Protocol` header
 * (the only request header a browser can set on a WebSocket) instead of the
 * URL query string, so the long-lived token never lands in access logs or
 * browser history. The host offers two subprotocols: the marker
 * `WS_SUBPROTOCOL` plus the token itself. The server echoes only the marker
 * (never the token), and reads the token from the request header.
 */
import { WS_SUBPROTOCOL } from '../socket.constants'
import type { UpgradeRequest } from '../socket.types'

/**
 * `ws` handleProtocols hook. Called only when the client offers ≥1 subprotocol.
 * Returns the marker when present (so browsers see an accepted protocol), else
 * false — which simply omits the echo header; it does NOT reject the socket.
 */
export function selectSubprotocol(protocols: Set<string>): string | false {
  return protocols.has(WS_SUBPROTOCOL) ? WS_SUBPROTOCOL : false
}

/**
 * Extract the host token from the `Sec-WebSocket-Protocol` request header:
 * the offered subprotocol that isn't the marker. Returns undefined if absent.
 */
export function parseHostTokenFromHeaders(headers: UpgradeRequest['headers']): string | undefined {
  const raw = headers?.['sec-websocket-protocol']
  if (!raw) {
    return undefined
  }
  return raw
    .split(',')
    .map((part) => part.trim())
    .find((part) => part.length > 0 && part !== WS_SUBPROTOCOL)
}

/**
 * The first IP in an `x-forwarded-for` header (which may arrive as a string or a
 * string[]). Returns the parsed value (possibly '') when the header is usable, or
 * undefined when there is no usable header so the caller can fall back.
 */
function firstForwardedIp(forwarded: string | string[] | undefined): string | undefined {
  const headerValue = Array.isArray(forwarded) ? forwarded[0] : forwarded
  if (typeof headerValue !== 'string' || headerValue.length === 0) {
    return undefined
  }
  return (headerValue.split(',')[0] ?? '').trim()
}

/** Best-effort client IP for throttling/logging; '' when unavailable. */
export function clientIp(request: UpgradeRequest | undefined): string {
  if (process.env['TRUST_PROXY'] === 'true') {
    const forwarded = firstForwardedIp(request?.headers?.['x-forwarded-for'])
    if (forwarded !== undefined) {
      return forwarded
    }
  }
  return request?.socket?.remoteAddress ?? ''
}
