import { ENV } from '@config/env.config'

export function makeServerURL(route: string): string {
  const raw = `${ENV.SERVER_BASE_URL}/${route}`

  const url: URL = new URL(raw)

  return url.toString().replace(/\/$/, '')
}
