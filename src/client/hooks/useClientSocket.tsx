/**
 * @file useClientSocket.tsx
 * @description React hook that manages the client WebSocket connection, including
 * connection lifecycle, reconnection logic, and credential persistence. It uses
 * a reducer to handle state transitions based on server events and user actions.
 */

import { useEffect, useReducer, useRef } from 'react'
import type { PlayerAvatar } from '@brain-wiz/shared/types/index'
import { loadSavedPlayer, saveSavedPlayer, clearSavedPlayer } from '../helpers/saved-player'
import { clientSocketReducer, createInitialClientState } from './clientSocketReducer'
import {
  buildAnswerMessage,
  buildJoinMessage,
  buildRoundProgressMessage,
  buildRoundSubmitMessage,
} from './clientMessages'
import {
  BACKEND_WS_URL,
  CONNECT_DELAY_MS,
  MAX_RECONNECT_ATTEMPTS,
  RECONNECT_DELAY_MS,
} from './useClientSocket.constants'

export function useClientSocket() {
  const [state, dispatch] = useReducer(
    clientSocketReducer,
    loadSavedPlayer(),
    createInitialClientState
  )

  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  })

  const socketRef = useRef<WebSocket | null>(null)
  const intentionalCloseRef = useRef(false)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (state.creds) {
      saveSavedPlayer(state.creds)
    } else {
      clearSavedPlayer()
    }
  }, [state.creds])

  useEffect(() => {
    if (state.kicked) {
      socketRef.current?.close()
    }
  }, [state.kicked])

  function sendJoin(
    name: string,
    code: string,
    playerAvatar: PlayerAvatar,
    creds: typeof state.creds
  ): void {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    socket.send(buildJoinMessage(name, code, playerAvatar, creds))
  }

  function connect(): void {
    intentionalCloseRef.current = false
    dispatch({ type: 'connecting' })
    const socket = new WebSocket(BACKEND_WS_URL)
    socketRef.current = socket

    socket.onopen = () => {
      if (socketRef.current !== socket) return
      dispatch({ type: 'opened' })
      reconnectAttemptsRef.current = 0
      const { creds, pendingJoin } = stateRef.current
      if (creds) {
        sendJoin(creds.playerName, creds.roomCode, creds.playerAvatar, creds)
      } else if (pendingJoin) {
        sendJoin(pendingJoin.name, pendingJoin.code, pendingJoin.playerAvatar, null)
      }
    }

    socket.onmessage = (event) => {
      if (socketRef.current !== socket) return
      try {
        const { event: ev, data } = JSON.parse(event.data) as { event: string; data: unknown }
        dispatch({ type: 'serverEvent', event: ev, data })
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err)
      }
    }

    socket.onclose = () => {
      if (socketRef.current !== socket) return
      dispatch({ type: 'closed' })
      if (intentionalCloseRef.current) return
      const { creds } = stateRef.current
      if (creds && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current += 1
        reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS)
      } else if (creds) {
        dispatch({ type: 'reconnectExhausted' })
      }
    }

    socket.onerror = () => {
      console.error('WebSocket connection error')
    }
  }

  const connectRef = useRef(connect)
  useEffect(() => {
    connectRef.current = connect
  })

  useEffect(() => {
    const connectTimer = setTimeout(() => {
      connectRef.current()
    }, CONNECT_DELAY_MS)

    return () => {
      clearTimeout(connectTimer)
      intentionalCloseRef.current = true
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      if (socketRef.current && socketRef.current.readyState === WebSocket.CONNECTING) {
        socketRef.current.onerror = null
      }
      socketRef.current?.close()
    }
  }, [])

  function handleJoin(name: string, code: string, playerAvatar: PlayerAvatar): void {
    dispatch({ type: 'joinStarted' })
    const socket = socketRef.current
    if (socket && socket.readyState === WebSocket.OPEN) {
      sendJoin(name, code, playerAvatar, null)
    } else {
      dispatch({ type: 'pendingJoinSet', pending: { name, code, playerAvatar } })
      if (!socket || socket.readyState === WebSocket.CLOSED) connect()
    }
  }

  function handleAnswer(answerId: string): void {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    dispatch({ type: 'answerSelected', answerId })
    socket.send(buildAnswerMessage(answerId))
  }

  function handleRoundSubmit(submission: unknown): void {
    const socket = socketRef.current
    const { roundContent } = stateRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN || !roundContent) return
    dispatch({ type: 'roundSubmitted' })
    socket.send(buildRoundSubmitMessage(roundContent, submission))
  }

  function handleRoundProgress(submission: unknown): void {
    const socket = socketRef.current
    const { roundContent, roundSubmitted } = stateRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN || !roundContent || roundSubmitted) return
    socket.send(buildRoundProgressMessage(roundContent, submission))
  }

  function handleLeaveRoom(): void {
    intentionalCloseRef.current = true
    if (socketRef.current) {
      socketRef.current.close()
      socketRef.current = null
    }
    dispatch({ type: 'leftRoom' })
  }

  function selectOption(choiceId: string, submission: unknown): void {
    dispatch({ type: 'optionSelected', choiceId })
    handleRoundSubmit(submission)
  }

  function clearFatalError(): void {
    dispatch({ type: 'fatalCleared' })
  }

  return {
    ...state,
    handleJoin,
    handleAnswer,
    handleRoundSubmit,
    handleRoundProgress,
    handleLeaveRoom,
    selectOption,
    clearFatalError,
  }
}
