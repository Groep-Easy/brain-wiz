const BACKEND_PORT = '3000'
const CLIENT_DEV_PORT = '5173'
const HOST_DEV_PORT = '5174'
const LOCALHOST = 'localhost'

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

const buildUrl = (
  protocol: 'http:' | 'https:' | 'ws:' | 'wss:',
  host: string,
  port?: string
): string => {
  const url = new URL(`${protocol}//${host}`)
  if (port) {
    url.port = port
  }
  return trimTrailingSlash(url.toString())
}

const getBrowserWebSocketProtocol = (): 'ws:' | 'wss:' => {
  return window.location.protocol === 'https:' ? 'wss:' : 'ws:'
}

const getBrowserHttpProtocol = (): 'http:' | 'https:' => {
  return window.location.protocol === 'https:' ? 'https:' : 'http:'
}

export const isDevelopment = (): boolean => {
  if (typeof process !== 'undefined' && process.env['NODE_ENV']) {
    return process.env['NODE_ENV'] !== 'production'
  }

  // Vite dev servers don't expose process.env to the browser.
  // We can safely assume development if we are on the known dev ports or localhost.
  if (typeof window !== 'undefined') {
    const port = window.location.port
    if (port === CLIENT_DEV_PORT || port === HOST_DEV_PORT) return true
    if (window.location.hostname === LOCALHOST) return true
  }

  return false
}

export const getBackendWsUrl = (envUrl?: string): string => {
  if (envUrl) return envUrl

  if (typeof window !== 'undefined') {
    if (isDevelopment()) {
      return buildUrl(getBrowserWebSocketProtocol(), window.location.hostname, BACKEND_PORT)
    }

    return buildUrl(getBrowserWebSocketProtocol(), window.location.host)
  }

  return buildUrl('ws:', LOCALHOST, BACKEND_PORT)
}

export const getBackendHttpUrl = (wsUrl: string): string => {
  return wsUrl.replace(/^ws/i, 'http')
}

export const getClientBaseUrl = (): string => {
  if (isDevelopment() && typeof window !== 'undefined') {
    return buildUrl(getBrowserHttpProtocol(), window.location.hostname, CLIENT_DEV_PORT)
  }

  if (typeof window !== 'undefined') return window.location.origin

  return buildUrl('http:', LOCALHOST, BACKEND_PORT)
}

/** Base URL of the host display app, where the welcome/start screen lives. */
export const getHostBaseUrl = (): string => {
  if (isDevelopment() && typeof window !== 'undefined') {
    return buildUrl(getBrowserHttpProtocol(), window.location.hostname, HOST_DEV_PORT)
  }

  if (typeof window !== 'undefined') return window.location.origin

  return buildUrl('http:', LOCALHOST, BACKEND_PORT)
}
