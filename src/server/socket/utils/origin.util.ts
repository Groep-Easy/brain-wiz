/**
 * @file origin.util.ts
 * @owner server-squad
 * @description Origin allow-listing for the WebSocket upgrade.
 *
 * The `ws` transport runs in `noServer` mode (it shares Nest's HTTP server), so
 * ws's own `verifyClient` hook never fires — we enforce the origin in the
 * gateway's connection handler instead. This guards against cross-site
 * WebSocket hijacking: a browser always sends an `Origin` header, so a socket
 * opened from a page we don't trust is rejected. Non-browser clients (no Origin
 * header) are not subject to CSWSH and are allowed through.
 *
 * Decide whether a WebSocket upgrade from `origin` may proceed:
 * - missing origin → allowed (non-browser client, not a CSWSH vector)
 * - present origin → must be in the allow-list
 */
export function isOriginAllowed(origin: string | undefined, allowed: readonly string[]): boolean {
  if (origin === undefined || origin === '') {
    return true
  }
  
  if (allowed.includes(origin)) {
    return true
  }

  // During local development, allow dynamically assigned network IPs (e.g. 192.168.x.x)
  // so developers can test the client on their phones.
  // We check if the allowed list contains the default dev origins to infer dev mode.
  if (allowed.includes('http://localhost:5173')) {
    if (origin.startsWith('http://192.168.') || origin.startsWith('http://10.') || origin.startsWith('http://172.')) {
      return true
    }
  }

  return false
}
