/**
 * @file hostSocketReducer.constants.ts
 * @description Pure constants for the host WebSocket state machine. Kept separate
 * from useHostSocket.constants.ts (which uses Vite's `import.meta.env`) so the
 * reducer stays node-testable.
 */

export const HOST_UNAUTHORIZED_CLOSE_CODE = 4004
