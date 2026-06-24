import { DEFAULTS } from '@brain-wiz/shared/constants/env.constants'
import { NodeEnv } from '../types/env'

function getEnvString(key: string, fallback?: string): string {
  const value = process.env[key]
  return value ?? (fallback as string)
}

function getEnvNumber(key: string, fallback: number): number {
  const value = process.env[key]
  if (!value) return fallback
  const parsed = Number(value)
  return Number.isNaN(parsed) ? fallback : parsed
}

function getEnvBoolean(key: string, fallback: boolean): boolean {
  const value = process.env[key]
  if (!value) return fallback
  return value.toLowerCase() === 'true'
}

function getEnvArray(key: string): string[] {
  const value = process.env[key]
  if (!value) return []
  return value
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
}

export const Environment = Object.freeze({
  SERVER_PORT: getEnvNumber('SERVER_PORT', DEFAULTS.SERVER_PORT),

  SERVER_LOCATION: getEnvString('SERVER_LOCATION', DEFAULTS.SERVER_LOCATION),

  SERVER_HOST: getEnvString('SERVER_HOST', DEFAULTS.SERVER_HOST),

  TRUST_PROXY: getEnvBoolean('TRUST_PROXY', DEFAULTS.TRUST_PROXY),

  CORS_ORIGINS: getEnvArray('CORS_ORIGINS'),

  NODE_ENV: getEnvString('NODE_ENV', DEFAULTS.NODE_ENV) as NodeEnv,

  ADMIN_API_KEY: getEnvString('ADMIN_API_KEY'),

  DB_HOST: getEnvString('DB_HOST', DEFAULTS.DB_HOST),

  DB_PORT: getEnvNumber('DB_PORT', DEFAULTS.DB_PORT),

  DB_USERNAME: getEnvString('DB_USERNAME'),

  DB_PASSWORD: getEnvString('DB_PASSWORD'),

  DB_NAME: getEnvString('DB_NAME'),

  DB_SSL: getEnvBoolean('DB_SSL', DEFAULTS.DB_SSL),

  DB_SYNCHRONIZE: getEnvBoolean('DB_SYNCHRONIZE', DEFAULTS.DB_SYNCHRONIZE),

  DB_DROP_SCHEMA: getEnvBoolean('DB_DROP_SCHEMA', DEFAULTS.DB_DROP_SCHEMA),

  DB_POOL_MIN: getEnvNumber('DB_POOL_MIN', DEFAULTS.DB_POOL_MIN),

  DB_POOL_MAX: getEnvNumber('DB_POOL_MAX', DEFAULTS.DB_POOL_MAX),

  DB_QUERY_TIMEOUT: getEnvNumber('DB_QUERY_TIMEOUT', DEFAULTS.DB_QUERY_TIMEOUT),

  DB_IDLE_TIMEOUT: getEnvNumber('DB_IDLE_TIMEOUT', DEFAULTS.DB_IDLE_TIMEOUT),

  DB_LOG_LEVEL: getEnvString('DB_LOG_LEVEL', DEFAULTS.DB_LOG_LEVEL),

  DB_LOGGING_ENABLED: getEnvBoolean('DB_LOGGING_ENABLED', DEFAULTS.DB_LOGGING_ENABLED),

  SERVER_API_VERSION: getEnvString('SERVER_API_VERSION', DEFAULTS.SERVER_API_VERSION),
})
