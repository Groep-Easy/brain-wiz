#!/usr/bin/env node
/**
 * @file dev.js
 * @owner git-master
 * @description Development runner. Starts server with file watching.
 * Usage: npm run dev
 */
import { spawn } from 'child_process'
import { watch } from 'fs'

let serverProcess = null

function startServer() {
  if (serverProcess) { serverProcess.kill() }
  serverProcess = spawn('node', ['src/server/index.js'], { stdio: 'inherit' })
  serverProcess.on('exit', (code) => {
    if (code !== null && code !== 0) {
      // eslint-disable-next-line no-console
      console.error(`Server exited with code ${code}`)
    }
  })
}

startServer()

// Restart server on any src/server change
watch('src/server', { recursive: true }, (event, filename) => {
  if (filename && filename.endsWith('.js')) {
    // eslint-disable-next-line no-console
    console.log(`[dev] ${filename} changed — restarting server`)
    startServer()
  }
})

// eslint-disable-next-line no-console
console.log('[dev] Watching src/server for changes...')
