import { NodeEnv } from "../types/env";

export const DEFAULTS = {
  SERVER_PORT: 3000,
  SERVER_LOCATION: 'localhost',

  NODE_ENV: NodeEnv.Development,

  DB_HOST: 'localhost',
  DB_PORT: 5432,
  DB_SSL: false,

  DB_SYNCHRONIZE: false,
  DB_DROP_SCHEMA: false,

  DB_POOL_MIN: 3,
  DB_POOL_MAX: 10,

  DB_QUERY_TIMEOUT: 30_000,
  DB_IDLE_TIMEOUT: 900_000,

  DB_LOG_LEVEL: 'error',

  DB_LOGGING_ENABLED: false,

  SERVER_API_VERSION: '1.0',
} as const

