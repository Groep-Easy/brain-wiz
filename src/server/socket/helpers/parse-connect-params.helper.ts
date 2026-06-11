import { NO_QUERY_INDEX } from '../socket.constants'
import { ConnectParams } from '../socket.types'

/**
 * Parse `role`/`code` from the WebSocket upgrade request URL.
 * NOTE: `hostToken` query params are disallowed for security reasons; tokens
 * must be supplied via the Sec-WebSocket-Protocol header only.
 */
export function parseConnectParams(url: string | undefined): ConnectParams {
  if (!url) return {}

  const queryIndex = url.indexOf('?')
  if (queryIndex === NO_QUERY_INDEX) return {}

  const search = new URLSearchParams(url.slice(queryIndex + 1))
  const params: ConnectParams = {}

  const role = search.get('role')
  const code = search.get('code')
  if (role) params.role = role
  if (code) params.code = code

  return params
}
