import { useEffect, useReducer, useRef } from 'react'
import { WS_SUBPROTOCOL } from '@brain-wiz/shared/constants/ws.constants'
import { hostSocketReducer, createInitialHostState } from './hostSocketReducer'
import { BACKEND_HTTP_URL, BACKEND_WS_URL, CONNECT_DELAY_MS } from './useHostSocket.constants'

/**
 * Owns the host WebSocket: it connects for a given room/token and feeds inbound
 * events to the pure `hostSocketReducer` (unit-tested separately). The host is a
 * passive display, so this hook only receives state and exposes actions to start
 * the game or tear the connection down; the screen layer renders the result.
 */
export function useHostSocket(roomCode: string | undefined, hostToken: string | null) {
  const [state, dispatch] = useReducer(hostSocketReducer, createInitialHostState())

  const socketRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!roomCode || !hostToken) {
      dispatch({ type: 'unauthorized' })
      return
    }

    dispatch({ type: 'connecting' })

    const connectTimer = setTimeout(() => {
      const wsUrl = `${BACKEND_WS_URL}/?role=host&code=${roomCode}`
      const socket = new WebSocket(wsUrl, [WS_SUBPROTOCOL, hostToken])
      socketRef.current = socket

      socket.onopen = () => {
        dispatch({ type: 'opened' })
      }

      socket.onmessage = (event) => {
        try {
          const { event: ev, data } = JSON.parse(event.data) as { event: string; data: unknown }
          dispatch({ type: 'serverEvent', event: ev, data })
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err)
        }
      }

      socket.onclose = (event) => {
        dispatch({ type: 'closed', code: event.code })
        // Do not clear tokens or code so we can attempt reconnect if desired
      }

      socket.onerror = () => {
        console.error('WebSocket connection error')
      }
    }, CONNECT_DELAY_MS)

    return () => {
      clearTimeout(connectTimer)
      if (socketRef.current && socketRef.current.readyState === WebSocket.CONNECTING) {
        socketRef.current.onerror = null
      }
      socketRef.current?.close()
    }
  }, [roomCode, hostToken])

  useEffect(() => {
    return () => {
      socketRef.current?.close()
    }
  }, [])

  const handleStartGame = async (): Promise<void> => {
    if (!roomCode || !hostToken) return
    try {
      const res = await fetch(`${BACKEND_HTTP_URL}/rooms/${roomCode}/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ hostToken }),
      })
      if (!res.ok) {
        const errorText = await res.text()
        console.error(`Failed to start game: ${errorText}`)
        return
      }
    } catch {
      console.error(`needs at least 2 players`)
    }
  }

  /** Close the socket and reset to a disconnected state (caller handles navigation). */
  const closeConnection = (): void => {
    socketRef.current?.close()
    socketRef.current = null
    dispatch({ type: 'closed' })
  }

  return {
    ...state,
    handleStartGame,
    closeConnection,
  }
}
