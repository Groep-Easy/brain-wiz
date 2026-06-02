/**
 * @file handlers.ts
 * @owner server-squad
 * @description Registers all Socket.io connection and event handlers.
 * Import socket event name constants — never use raw strings.
 */
import type { Server, Socket } from 'socket.io'
import * as EVENTS from '../../shared/events/socket-events.js'
import { RoomManager } from '../core/room-manager.js'

const roomManager = new RoomManager()
void roomManager

export function registerSocketHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    socket.on(EVENTS.PLAYER_JOIN, (payload: unknown) => {
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

    socket.on(EVENTS.ANSWER_SUBMIT, (payload: unknown) => {
      // TODO: implement in week 2
      void payload
    })
  })
}
