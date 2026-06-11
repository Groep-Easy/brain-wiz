/**
 * @file src/server/socket/helpers/index.ts
 * @description Socket helper exports. Pure functions with no NestJS/module
 * dependencies, so this barrel is safe to import from anywhere — including the
 * lobby's connection-registry — without pulling in SocketModule.
 */
export { parseConnectParams } from './parse-connect-params.helper'
export { safeEqual } from './secure-compare.helper'
export { selectSubprotocol, parseHostTokenFromHeaders, clientIp } from './handshake.helper'
