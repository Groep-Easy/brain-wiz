/**
 * @file handlers.js
 * @owner server-squad
 * @description Registers all Socket.io connection and event handlers.
 * Import socket event name constants — never use raw strings.
 */
import * as EVENTS from '../../../src/shared/events/socket-events.js'
import { RoomManager } from '../core/room-manager.js'

const roomManager = new RoomManager()

/**
 * @param {import('socket.io').Server} io
 */
export function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    socket.on(EVENTS.PLAYER_JOIN, (payload) => {
      // TODO: implement in week 1
      void payload
    })

    socket.on(EVENTS.PLAYER_LEAVE, () => {
      // TODO: implement in week 1
    })

    socket.on('disconnect', () => {
      // TODO: handle reconnect window in week 1
    })

    socket.on(EVENTS.GAME_START, () => {
      // TODO: implement in week 2
    })

    socket.on(EVENTS.ANSWER_SUBMIT, (payload) => {
      // TODO: implement in week 2
      void payload
    })
  })
}
