import { EnvironmentSchema } from '@brain-wiz/shared/dto/env.dto'
import { NodeEnv } from '@brain-wiz/shared/types/env'

const HTTP_PORT = 80
const HTTPS_PORT = 443

function makeBaseUrl(serverLocatie: string, port: number): string {
  const isHttps = port === HTTPS_PORT
  const scheme = isHttps ? 'https' : 'http'
  // Omit the port from the URL for the standard HTTP/HTTPS ports.
  const isDefaultPort = port === HTTP_PORT || port === HTTPS_PORT
  const raw = isDefaultPort ? `${scheme}://${serverLocatie}` : `${scheme}://${serverLocatie}:${port}`

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`Invalid BASE_URL: must be a valid URL, got "${raw}"`)
  }

  return url.toString().replace(/\/$/, '')
}

const DEFAULT_DEV_CORS_ORIGINS = ['http://localhost:5173', 'http://localhost:5174']

function corsOrigins(node_env: NodeEnv, fromEnv: readonly string[]): string[] {
  if (node_env === NodeEnv.Production) {
    return [...fromEnv]
  }
  return [...new Set([...DEFAULT_DEV_CORS_ORIGINS, ...fromEnv])]
}

const parsed = EnvironmentSchema.parse(process.env)

const extendedEnv = {
  ...parsed,
  SERVER_BASE_URL: makeBaseUrl(parsed.SERVER_LOCATION, parsed.SERVER_PORT),
  CORS_ORIGINS: corsOrigins(parsed.NODE_ENV, parsed.CORS_ORIGINS),
}

export const ENV = Object.freeze(extendedEnv)
