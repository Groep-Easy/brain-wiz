export const isDevelopment = (): boolean => {
  if (typeof process !== 'undefined' && process.env['NODE_ENV']) {
    return process.env['NODE_ENV'] !== 'production'
  }

  // Vite dev servers don't expose process.env to the browser.
  // We can safely assume development if we are on the known dev ports or localhost.
  if (typeof window !== 'undefined') {
    const port = window.location.port
    if (port === '5173' || port === '5174') return true
    if (window.location.hostname === 'localhost') return true
  }

  return false
}

export const getBackendWsUrl = (envUrl?: string): string => {
  if (envUrl) return envUrl
  if (isDevelopment() && typeof window !== 'undefined') {
    return `ws://${window.location.hostname}:3000`
  }
  if (typeof window !== 'undefined') {
    return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
  }
  return 'ws://localhost:3000'
}

export const getBackendHttpUrl = (wsUrl: string): string => {
  return wsUrl.replace(/^ws/i, 'http')
}

export const getClientBaseUrl = (): string => {
  if (isDevelopment() && typeof window !== 'undefined') {
    return `http://${window.location.hostname}:5173`
  }
  if (typeof window !== 'undefined') return window.location.origin
  return 'http://localhost:3000'
}
