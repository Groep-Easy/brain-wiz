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
import { ENV } from './env.config'
import { getDatabaseConfig } from './database.config'

export const server_config = Object.freeze({
  PORT: ENV.SERVER_PORT,
  NODE_ENV: ENV.NODE_ENV,
  BASE_URL: ENV.SERVER_BASE_URL,
  CORS_ORIGINS: ENV.CORS_ORIGINS,
  ADMIN_API_KEY: ENV.ADMIN_API_KEY,
  DATABASE: getDatabaseConfig(),
})
