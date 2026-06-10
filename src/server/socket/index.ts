/**
 * @file src/server/socket/index.ts
 * @description Public entry point for the WebSocket transport module.
 *
 * Exposes SocketModule for app-level wiring. The pure helpers live in their own
 * barrel (./helpers/index) and must be imported from there — NOT re-exported
 * here. This barrel loads SocketModule -> LobbyModule, and the lobby consumes a
 * socket helper, so routing helper imports through this barrel would create a
 * module cycle.
 */
export { SocketModule } from './socket.module'
