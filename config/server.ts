/**
 * @file config/server.ts
 * @description Runtime server configuration with validation.
 *
 * This module reads and validates all server configuration from environment
 * variables. It's frozen to prevent accidental runtime mutations.
 *
 * IMPORTANT: Environment validation happens here on startup. If any required
 * variables are missing, the application will fail fast with a clear error.
 */
import { getDatabaseConfig } from './database.js'

const DEFAULT_PORT = 3000

/**
 * Validate port is within valid range
 */
function validatePort(port: number): void {
  if (port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: must be between 1 and 65535, got ${port}`)
  }
}

/**
 * Parse and validate port from environment
 */
function parsePort(): number {
  const portStr = process.env['PORT']
  if (!portStr) return DEFAULT_PORT

  const port = parseInt(portStr, 10)
  if (isNaN(port)) {
    throw new Error(`Invalid PORT: must be a number, got "${portStr}"`)
  }

  validatePort(port)
  return port
}

/**
 * Parse NODE_ENV with validation
 */
function parseNodeEnv(): 'development' | 'production' | 'test' {
  const env = process.env['NODE_ENV'] ?? 'development'
  if (!['development', 'production', 'test'].includes(env)) {
    throw new Error(`Invalid NODE_ENV: must be one of development|production|test, got "${env}"`)
  }
  return env as 'development' | 'production' | 'test'
}

/**
 * Parse base URL for QR code and join links
 */
function parseBaseUrl(port: number): string {
  const raw = process.env['BASE_URL'] ?? `http://localhost:${port}`

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`Invalid BASE_URL: must be a valid URL, got "${raw}"`)
  }

  return url.toString().replace(/\/$/, '')
}

// Load configurations with validation
const nodeEnv = parseNodeEnv()
const port = parsePort()

// Database config is validated here - will throw if invalid
const databaseConfig = getDatabaseConfig()

// Base URL validated on startup
const baseUrl = parseBaseUrl(port)

export const config = Object.freeze({
  PORT: port,
  NODE_ENV: nodeEnv,
  BASE_URL: baseUrl,
  DATABASE: databaseConfig,
})
