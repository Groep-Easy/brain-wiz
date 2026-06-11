export const isLocalhost = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  )
}

export const getBackendWsUrl = (envUrl?: string): string => {
  if (envUrl) return envUrl
  if (isLocalhost()) return 'ws://localhost:3000'
  if (typeof window !== 'undefined') {
    return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
  }
  return 'ws://localhost:3000'
}

export const getBackendHttpUrl = (wsUrl: string): string => {
  return wsUrl.replace(/^ws/i, 'http')
}

export const getClientBaseUrl = (): string => {
  if (isLocalhost()) return 'http://localhost:5173'
  if (typeof window !== 'undefined') return window.location.origin
  return 'http://localhost:3000'
}
