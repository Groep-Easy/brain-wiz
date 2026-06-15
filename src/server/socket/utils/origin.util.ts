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
  return allowed.includes(origin)
}
