import { env } from './env-handelers'

export function getServerBaseURL(): string {
  return makeServerURL('')
}

export function makeServerURL(route: string): string {
  const raw = `http://${env.SERVER_LOCATION}:${env.SERVER_PORT}/${route}`

  let url: URL = new URL(raw)

  return url.toString().replace(/\/$/, '')
}
