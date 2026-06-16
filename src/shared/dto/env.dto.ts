import { z } from 'zod'
import { DEFAULTS } from '@shared/constants/env.constants'
import { NodeEnv } from '../types/env'

export const EnvironmentSchema = z.object({
  SERVER_PORT: z.coerce.number().default(DEFAULTS.SERVER_PORT),

  SERVER_LOCATION: z.string().default(DEFAULTS.SERVER_LOCATION),

  NODE_ENV: z.enum(NodeEnv).default(DEFAULTS.NODE_ENV),

  ADMIN_API_KEY: z.string(),

  DB_HOST: z.string().default(DEFAULTS.DB_HOST),

  DB_PORT: z.coerce.number().default(DEFAULTS.DB_PORT),

  DB_USERNAME: z.string(),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string(),

  DB_SSL: z.coerce.boolean().default(DEFAULTS.DB_SSL),

  DB_SYNCHRONIZE: z.coerce.boolean().default(DEFAULTS.DB_SYNCHRONIZE),

  DB_DROP_SCHEMA: z.coerce.boolean().default(DEFAULTS.DB_DROP_SCHEMA),

  DB_POOL_MIN: z.coerce.number().default(DEFAULTS.DB_POOL_MIN),

  DB_POOL_MAX: z.coerce.number().default(DEFAULTS.DB_POOL_MAX),

  DB_QUERY_TIMEOUT: z.coerce.number().default(DEFAULTS.DB_QUERY_TIMEOUT),

  DB_IDLE_TIMEOUT: z.coerce.number().default(DEFAULTS.DB_IDLE_TIMEOUT),

  DB_LOG_LEVEL: z.string().default(DEFAULTS.DB_LOG_LEVEL),

  DB_LOGGING_ENABLED: z.coerce.boolean().default(DEFAULTS.DB_LOGGING_ENABLED),

  PGADMIN_DEFAULT_EMAIL: z.email(),
  PGADMIN_DEFAULT_PASSWORD: z.string(),

  SERVER_API_VERSION: z.string().default(DEFAULTS.SERVER_API_VERSION),
})

export type Environment = z.infer<typeof EnvironmentSchema>
