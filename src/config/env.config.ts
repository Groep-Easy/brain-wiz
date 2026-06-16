import { EnvironmentSchema } from '@shared/dto/env.dto'
import { NodeEnv } from '@shared/types/env'

const HTTP_PORT = 80
const HTTPS_PORT = 80

function makeBaseUrl(serverLocatie: string, port: number): string {
  let raw = ''
  if (port in [HTTP_PORT, HTTPS_PORT]) raw = `http://${serverLocatie}`
  else raw = `http://${serverLocatie}:${port}`

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

const extendedEnv = {
  ...parsed,
  SERVER_BASE_URL: makeBaseUrl(parsed.SERVER_LOCATION, parsed.SERVER_PORT),
  CORS_ORIGINS: corsOrigins(parsed.NODE_ENV),
}

export const ENV = Object.freeze(extendedEnv)
