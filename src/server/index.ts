/**
 * @file index.ts
 * @owner server-squad
 * @description Server entry point. Bootstraps Express + Socket.io.
 * Keep this file thin — it wires things together, nothing else.
 */
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { registerSocketHandlers } from './socket/handlers.js'
import { config } from '../../config/server.js'

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: '*' }, // local network — all origins allowed
})

// Serve static host display
app.use('/host', express.static('src/host'))

// Serve static phone client
app.use('/', express.static('src/client'))

// Register all socket event handlers
registerSocketHandlers(io)

httpServer.listen(config.PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`Brain Wis running on http://0.0.0.0:${config.PORT}`)
  // eslint-disable-next-line no-console
  console.log(`Host display: http://localhost:${config.PORT}/host`)
})
