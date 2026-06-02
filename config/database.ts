/**
 * @file config/database.ts
 * @description Database connection configuration with strict validation.
 *
 * This module:
 * - Reads database configuration from environment variables
 * - Validates all required fields are present and valid
 * - Applies sensible defaults for optional fields
 * - Provides clear error messages if validation fails
 * - Exports typed configuration for TypeORM and NestJS
 */

const MIN_PASSWORD_LENGTH = 8
const MAX_PORT_NUMBER = 65535
const DEFAULT_POOL_MIN = 3
const DEFAULT_POOL_MAX = 10
const DEFAULT_QUERY_TIMEOUT = 30000
const DEFAULT_IDLE_TIMEOUT = 900000

/**
 * Database configuration object
 * Mirrors TypeORM DataSourceOptions structure
 */
export interface DatabaseConfig {
  type: 'postgres'
  host: string
  port: number
  username: string
  password: string
  database: string
  entities: string[]
  migrations: string[]
  ssl: boolean | { rejectUnauthorized: boolean }
  poolSize: {
    min: number
    max: number
  }
  query: {
    timeout: number
  }
  logging: {
    level: 'query' | 'error'
    enabled: boolean
  }
  synchronize: boolean
  dropSchema: boolean
}

/**
 * Parse and validate integer environment variable
 * @throws Error if value is not a valid positive integer
 */
function parsePositiveInt(value: string | undefined, name: string, defaultValue?: number): number {
  if (value === undefined) {
    if (defaultValue !== undefined) return defaultValue
    throw new Error(`Missing required env var: ${name}`)
  }

  const parsed = parseInt(value, 10)
  if (isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${name}: must be a positive integer, got "${value}"`)
  }
  return parsed
}

/**
 * Parse and validate boolean environment variable
 */
function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue
  return value.toLowerCase() === 'true'
}

/**
 * Validate database password complexity
 * Prevents accidentally committing default passwords
 */
function validatePassword(password: string): void {
  if (password === 'your_secure_password_here') {
    throw new Error(
      'ERROR: DB_PASSWORD is not configured. ' +
        'Update .env with your actual PostgreSQL password. ' +
        'Never use the default placeholder in production.'
    )
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `DB_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters long (security requirement)`
    )
  }
}

/**
 * Load and validate database configuration from environment
 * Throws descriptive errors if validation fails
 */
export function loadDatabaseConfig(): DatabaseConfig {
  const nodeEnv = process.env['NODE_ENV'] ?? 'development'

  // Required fields
  const host = process.env['DB_HOST']
  const port = process.env['DB_PORT']
  const username = process.env['DB_USERNAME']
  const password = process.env['DB_PASSWORD']
  const database = process.env['DB_NAME']

  // Validate required fields
  if (!host) throw new Error('Missing required env var: DB_HOST')
  if (!port) throw new Error('Missing required env var: DB_PORT')
  if (!username) throw new Error('Missing required env var: DB_USERNAME')
  if (!password) throw new Error('Missing required env var: DB_PASSWORD')
  if (!database) throw new Error('Missing required env var: DB_NAME')

  // Validate port is valid
  const portNum = parsePositiveInt(port, 'DB_PORT')
  if (portNum > MAX_PORT_NUMBER) {
    throw new Error(`Invalid DB_PORT: must be <= ${MAX_PORT_NUMBER}, got ${portNum}`)
  }

  // Validate password
  validatePassword(password)

  // Optional fields with sensible defaults
  const isSsl = parseBoolean(process.env['DB_SSL'], false)
  const poolMin = parsePositiveInt(process.env['DB_POOL_MIN'], 'DB_POOL_MIN', DEFAULT_POOL_MIN)
  const poolMax = parsePositiveInt(process.env['DB_POOL_MAX'], 'DB_POOL_MAX', DEFAULT_POOL_MAX)
  const queryTimeout = parsePositiveInt(
    process.env['DB_QUERY_TIMEOUT'],
    'DB_QUERY_TIMEOUT',
    DEFAULT_QUERY_TIMEOUT
  )
  // Idle timeout is validated but not used in this config version
  parsePositiveInt(process.env['DB_IDLE_TIMEOUT'], 'DB_IDLE_TIMEOUT', DEFAULT_IDLE_TIMEOUT)
  const logLevel = (process.env['DB_LOG_LEVEL'] ?? 'error') as 'query' | 'error'
  const isLoggingEnabled = parseBoolean(process.env['DB_LOGGING_ENABLED'], false)
  const shouldSynchronize = parseBoolean(process.env['DB_SYNCHRONIZE'], false)
  const shouldDropSchema = parseBoolean(process.env['DB_DROP_SCHEMA'], false)

  // Validate pool configuration
  if (poolMin > poolMax) {
    throw new Error(
      `Invalid pool configuration: DB_POOL_MIN (${poolMin}) cannot be greater than DB_POOL_MAX (${poolMax})`
    )
  }

  // Warn about dangerous settings in production
  if (nodeEnv === 'production') {
    if (shouldSynchronize) {
      throw new Error(
        'ERROR: DB_SYNCHRONIZE=true is forbidden in production. ' +
          'Always use migrations (DB_SYNCHRONIZE=false) in production.'
      )
    }
    if (shouldDropSchema) {
      throw new Error(
        'ERROR: DB_DROP_SCHEMA=true is forbidden in production. ' +
          'This would delete all production data.'
      )
    }
    if (isLoggingEnabled) {
      // eslint-disable-next-line no-console
      console.warn('WARNING: DB_LOGGING_ENABLED=true in production may impact performance')
    }
  }

  // Construct SSL config
  const sslConfig: boolean | { rejectUnauthorized: boolean } = isSsl
    ? { rejectUnauthorized: true }
    : false

  return {
    type: 'postgres',
    host,
    port: portNum,
    username,
    password,
    database,
    entities: ['dist/src/server/entities/**/*.entity.js'],
    migrations: ['dist/src/server/database/migrations/**/*.js'],
    ssl: sslConfig,
    poolSize: {
      min: poolMin,
      max: poolMax,
    },
    query: {
      timeout: queryTimeout,
    },
    logging: {
      level: logLevel,
      enabled: isLoggingEnabled,
    },
    synchronize: shouldSynchronize,
    dropSchema: shouldDropSchema,
  }
}

/**
 * Get database config instance (lazy-loaded on first access)
 * This ensures validation happens early, before NestJS bootstraps
 */
let configCache: DatabaseConfig | null = null

export function getDatabaseConfig(): DatabaseConfig {
  if (!configCache) {
    configCache = loadDatabaseConfig()
  }
  return configCache
}
