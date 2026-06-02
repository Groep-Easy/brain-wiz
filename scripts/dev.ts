#!/usr/bin/env node
/**
 * @file dev.ts
 * @owner git-master
 * @description Development runner. Compiles in watch mode and restarts the
 * server when the compiled output changes.
 * Usage: npm run dev  (runs `tsc` once first, then this orchestrator)
 */
import { spawn, type ChildProcess } from 'child_process'
import { watch } from 'fs'

const SERVER_ENTRY = 'dist/src/server/index.js'
const WATCH_DIR = 'dist/src/server'

let serverProcess: ChildProcess | null = null

function startServer(): void {
  if (serverProcess) {
    serverProcess.kill()
  }
  serverProcess = spawn('node', [SERVER_ENTRY], { stdio: 'inherit' })
  serverProcess.on('exit', (code) => {
    if (code !== null && code !== 0) {
      // eslint-disable-next-line no-console
      console.error(`Server exited with code ${code}`)
    }
  })
}

// Incrementally recompile TypeScript on change.
const tscProcess = spawn('npx', ['tsc', '--watch', '--preserveWatchOutput'], {
  stdio: 'inherit',
})
void tscProcess

startServer()

// Restart server whenever tsc rewrites the compiled server output.
watch(WATCH_DIR, { recursive: true }, (_event, filename) => {
  if (filename && filename.toString().endsWith('.js')) {
    // eslint-disable-next-line no-console
    console.log(`[dev] ${filename.toString()} changed — restarting server`)
    startServer()
  }
})

// eslint-disable-next-line no-console
console.log(`[dev] Watching ${WATCH_DIR} for changes...`)
