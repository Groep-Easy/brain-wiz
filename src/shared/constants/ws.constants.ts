/**
 * @file ws.ts
 * @owner git-master
 * @description WebSocket handshake constants shared by server and clients.
 */

/**
 * Marker subprotocol the host offers alongside its token, so the host token
 * travels in the `Sec-WebSocket-Protocol` header instead of the URL. The host
 * connects with `new WebSocket(url, [WS_SUBPROTOCOL, hostToken])`; the server
 * echoes only the marker and reads the token from the header.
 */
export const WS_SUBPROTOCOL = 'brain-wiz'
