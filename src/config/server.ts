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
import { env } from '../shared/utils/env-handelers'
import { getDatabaseConfig } from './database'

const DEFAULT_PORT = 3000
const MAX_PORT_NUMBER = 65535

/**
 * Validate port is within valid range
 */
function validatePort(port: number): void {
  if (port < 1 || port > MAX_PORT_NUMBER) {
    throw new Error(`Invalid SERVER_PORT: must be between 1 and ${MAX_PORT_NUMBER}, got ${port}`)
  }
}

/**
 * Parse and validate port from environment
 */
function parsePort(): number {
  const portStr = process.env['SERVER_PORT']
  if (!portStr) return DEFAULT_PORT

  const port = parseInt(portStr, 10)
  if (isNaN(port)) {
    throw new Error(`Invalid SERVER_PORT: must be a number, got "${portStr}"`)
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

/**
 * Local Vite dev servers (see vite.client.config.ts / vite.host.config.ts).
 * Allowed by default in development/test so the host display and phone client
 * can call the server (e.g. POST /rooms) from their own origin.
 */
const DEFAULT_DEV_CORS_ORIGINS = ['http://localhost:5173', 'http://localhost:5174']

/**
 * Parse the list of allowed CORS origins.
 *
 * Set CORS_ORIGINS to a comma-separated list to override (required in
 * production). When unset, development/test fall back to the local Vite dev
 * servers; production falls back to an empty list (cross-origin denied).
 */
function parseCorsOrigins(env: 'development' | 'production' | 'test'): string[] {
  const raw = process.env['CORS_ORIGINS']
  if (raw && raw.trim().length > 0) {
    return raw
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0)
  }
  return env === 'production' ? [] : [...DEFAULT_DEV_CORS_ORIGINS]
}

function parseApiKey(env: 'development' | 'production' | 'test'): string {
  const key = process.env['ADMIN_API_KEY']
  if (!key) {
    if (env === 'production') {
      throw new Error('ADMIN_API_KEY is required in production')
    }
    return 'dev-secret-key'
  }
  return key
}

// Load configurations with validation
const nodeEnv = parseNodeEnv()
const port = parsePort()
const corsOrigins = parseCorsOrigins(nodeEnv)
const adminApiKey = parseApiKey(nodeEnv)

// Database config is validated here - will throw if invalid
const databaseConfig = getDatabaseConfig()

// Base URL validated on startup
const baseUrl = parseBaseUrl(port)

export const server_config = Object.freeze({
  PORT: env.SERVER_PORT,
  NODE_ENV: env.NODE_ENV,
  BASE_URL: baseUrl,
  CORS_ORIGINS: Object.freeze(corsOrigins),
  ADMIN_API_KEY: adminApiKey,
  DATABASE: databaseConfig,
})
