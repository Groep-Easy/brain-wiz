export const isViteDevServer = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    (window.location.port === '5173' || window.location.port === '5174')
  )
}

export const getBackendWsUrl = (envUrl?: string): string => {
  if (envUrl) return envUrl
  if (isViteDevServer()) return `ws://${window.location.hostname}:3000`
  if (typeof window !== 'undefined') {
    return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
  }
  return 'ws://localhost:3000'
}

export const getBackendHttpUrl = (wsUrl: string): string => {
  return wsUrl.replace(/^ws/i, 'http')
}

export const getClientBaseUrl = (): string => {
  if (isViteDevServer()) return `http://${window.location.hostname}:5173`
  if (typeof window !== 'undefined') return window.location.origin
  return 'http://localhost:3000'
}
