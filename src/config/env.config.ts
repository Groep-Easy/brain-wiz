import { EnvironmentSchema } from '@shared/dto/env.dto'
import { NodeEnv } from '@shared/types/env'

function getBaseUrl(serverLocatie: string, port: number): string {
  let raw = ""
  if (port in [80, 433])
    raw = `http://${serverLocatie}`
  else
    raw = `http://${serverLocatie}:${port}`

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`Invalid BASE_URL: must be a valid URL, got "${raw}"`)
  }

  return url.toString().replace(/\/$/, '')
}

const DEFAULT_DEV_CORS_ORIGINS = ['http://localhost:5173', 'http://localhost:5174']

function corsOrigins(node_env: NodeEnv): string[] {
  return node_env == NodeEnv.Production ? [] : [...DEFAULT_DEV_CORS_ORIGINS]
}


const parsed = EnvironmentSchema.parse(process.env)

const extended_env = {
  ...parsed,
  SERVER_BASE_URL: getBaseUrl(parsed.SERVER_LOCATION, parsed.SERVER_PORT),
  CORS_ORIGINS: corsOrigins(parsed.NODE_ENV)
}

export const ENV = Object.freeze(extended_env)
