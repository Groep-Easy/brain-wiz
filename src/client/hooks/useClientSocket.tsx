import { useEffect, useRef, useState } from 'react'
import type {
  RoomState,
  RoundSummary,
  QuestionState,
  QuestionRevealPayload,
  LeaderboardEntry,
  ScoreMap,
  PlayerJoinAckPayload,
  PlayerJoinRejectedPayload,
  AnswerAckPayload,
  RoundContentPayload,
  RoundProgressPayload,
  RoundRevealPayload,
  PlayerAvatar,
  GamePhaseChangePayload,
  RoundStartPayload,
  TimerTickPayload,
  QuestionShowPayload,
  LeaderboardShowPayload,
  GameOverPayload,
} from '@brain-wiz/shared/types/index'
import * as EVENTS from '@brain-wiz/shared/constants/socket-events.constants'
import { getBackendWsUrl } from '@brain-wiz/shared/utils/env'
import type { SavedPlayer } from '../App.interfaces'
import { loadSavedPlayer, saveSavedPlayer, clearSavedPlayer } from '../helpers/saved-player'

const BACKEND_WS_URL = getBackendWsUrl(import.meta.env.VITE_WS_URL)
const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_DELAY_MS = 1500
const CONNECT_DELAY_MS = 50

/**
 * Owns the client WebSocket: connection lifecycle, reconnect, credential
 * persistence, and translation of inbound events into React state. The UI
 * consumes the returned state and action callbacks; it never touches the socket
 * directly.
 */
export function useClientSocket() {
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed'>('connecting')
  const [joined, setJoined] = useState(false)
  const [joining, setJoining] = useState<boolean>(() => loadSavedPlayer() !== null)
  const [roomState, setRoomState] = useState<RoomState | null>(null)
  const [round, setRound] = useState<RoundSummary | null>(null)
  const [question, setQuestion] = useState<QuestionState | null>(null)
  const [secondsRemaining, setSecondsRemaining] = useState(0)
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null)
  const [reveal, setReveal] = useState<QuestionRevealPayload | null>(null)
  const [roundContent, setRoundContent] = useState<RoundContentPayload | null>(null)
  const [roundReveal, setRoundReveal] = useState<RoundRevealPayload | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [finalScores, setFinalScores] = useState<ScoreMap | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [fatalError, setFatalError] = useState<string | null>(null)
  const [reconnectExhausted, setReconnectExhausted] = useState(false)
  const [roundSubmitted, setRoundSubmitted] = useState(false)
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [kicked, setKicked] = useState(false)

  const socketRef = useRef<WebSocket | null>(null)
  const playerIdRef = useRef<string | null>(null)
  const credsRef = useRef<SavedPlayer | null>(loadSavedPlayer())
  const pendingJoinRef = useRef<{ name: string; code: string; playerAvatar: PlayerAvatar } | null>(
    null
  )
  const intentionalCloseRef = useRef(false)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function sendJoin(
    name: string,
    code: string,
    playerAvatar: PlayerAvatar,
    creds: SavedPlayer | null
  ): void {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    socket.send(
      JSON.stringify({
        event: EVENTS.PLAYER_JOIN,
        data: {
          roomCode: code,
          playerName: name,
          playerAvatar,
          ...(creds ? { playerId: creds.playerId, playerToken: creds.reconnectToken } : {}),
        },
      })
    )
  }

  const handlers: Record<string, (data: unknown) => void> = {
    [EVENTS.PLAYER_JOIN_ACK]: (data) => {
      const ack = data as PlayerJoinAckPayload
      playerIdRef.current = ack.playerId
      const creds: SavedPlayer = {
        roomCode: ack.roomCode,
        playerName: credsRef.current?.playerName ?? pendingJoinRef.current?.name ?? '',
        playerId: ack.playerId,
        playerAvatar: ack.playerAvatar,
        reconnectToken: ack.reconnectToken,
      }
      credsRef.current = creds
      saveSavedPlayer(creds)
      pendingJoinRef.current = null
      setJoinError(null)
      setJoining(false)
      setJoined(true)
    },
    [EVENTS.PLAYER_JOIN_REJECTED]: (data) => {
      const rejected = data as PlayerJoinRejectedPayload
      credsRef.current = null
      clearSavedPlayer()
      setJoining(false)
      setJoined(false)
      if (rejected.reason === 'Room not found') {
        setFatalError('Room not found or game already started')
      } else {
        setJoinError(rejected.reason || 'Could not join the room.')
      }
    },
    [EVENTS.PLAYER_KICKED]: () => {
      setKicked(true)
      credsRef.current = null
      playerIdRef.current = null
      clearSavedPlayer()
      setJoined(false)
      setJoining(false)
      setRoomState(null)
      setFinalScores(null)
      socketRef.current?.close()
      setReconnectExhausted(false)
      setJoinError('You were kicked from the lobby')
    },
    [EVENTS.ROOM_STATE_UPDATE]: (data) => {
      setRoomState((data as { room: RoomState }).room)
    },
    [EVENTS.GAME_PHASE_CHANGE]: (data) => {
      const { phase } = data as GamePhaseChangePayload
      setRoomState((prev) => (prev ? { ...prev, phase } : prev))
    },
    [EVENTS.ROUND_START]: (data) => {
      const { round } = data as RoundStartPayload
      if (round) setRound(round)
      setRoundContent(null)
      setRoundReveal(null)
      setRoundSubmitted(false)
      setSelectedOptionId(null)
    },
    [EVENTS.TIMER_TICK]: (data) => {
      setSecondsRemaining((data as TimerTickPayload).secondsRemaining)
    },
    [EVENTS.QUESTION_SHOW]: (data) => {
      const { question } = data as QuestionShowPayload
      if (question) {
        setRoundContent(null)
        setRoundReveal(null)
        setQuestion(question)
        setReveal(null)
        setSelectedAnswerId(null)
      }
    },
    [EVENTS.ROUND_CONTENT_SHOW]: (data) => {
      const content = data as RoundContentPayload
      setRoundContent(content)
      setRoundReveal(null)
      setRoundSubmitted(false)
      setSelectedOptionId(null)
    },
    [EVENTS.QUESTION_REVEAL]: (data) => {
      setReveal(data as QuestionRevealPayload)
    },
    [EVENTS.ROUND_REVEAL]: (data) => {
      setRoundReveal(data as RoundRevealPayload)
    },
    [EVENTS.LEADERBOARD_SHOW]: (data) => {
      const { leaderboard } = data as LeaderboardShowPayload
      if (leaderboard) setLeaderboard(leaderboard)
    },
    [EVENTS.GAME_OVER]: (data) => {
      const { finalScores } = data as GameOverPayload
      if (finalScores) setFinalScores(finalScores)
    },
    [EVENTS.ANSWER_ACK]: (data) => {
      const ack = data as AnswerAckPayload
      if (!ack.accepted && (ack.reason === 'server-error' || ack.reason === 'invalid-answer')) {
        setSelectedAnswerId(null)
        setRoundSubmitted(false)
      }
    },
  }

  function handleEvent(ev: string, data: unknown): void {
    handlers[ev]?.(data)
  }

  function connect(): void {
    intentionalCloseRef.current = false
    setStatus('connecting')
    const socket = new WebSocket(BACKEND_WS_URL)
    socketRef.current = socket

    socket.onopen = () => {
      if (socketRef.current !== socket) return
      setStatus('open')
      setReconnectExhausted(false)
      reconnectAttemptsRef.current = 0
      const creds = credsRef.current
      if (creds) {
        sendJoin(creds.playerName, creds.roomCode, creds.playerAvatar, creds)
      } else if (pendingJoinRef.current) {
        sendJoin(
          pendingJoinRef.current.name,
          pendingJoinRef.current.code,
          pendingJoinRef.current.playerAvatar,
          null
        )
      }
    }

    socket.onmessage = (event) => {
      if (socketRef.current !== socket) return
      try {
        const { event: ev, data } = JSON.parse(event.data) as { event: string; data: unknown }
        handleEvent(ev, data)
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err)
      }
    }

    socket.onclose = () => {
      if (socketRef.current !== socket) return
      setStatus('closed')
      if (intentionalCloseRef.current) return
      if (credsRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current += 1
        reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS)
      } else if (credsRef.current) {
        setReconnectExhausted(true)
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
    setJoinError(null)
    setJoining(true)
    const socket = socketRef.current
    if (socket && socket.readyState === WebSocket.OPEN) {
      sendJoin(name, code, playerAvatar, null)
    } else {
      pendingJoinRef.current = { name, code, playerAvatar }
      if (!socket || socket.readyState === WebSocket.CLOSED) connect()
    }
  }

  function handleAnswer(answerId: string): void {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    setSelectedAnswerId(answerId)
    socket.send(
      JSON.stringify({
        event: EVENTS.ANSWER_SUBMIT,
        data: { answerId, timestamp: Date.now() },
      })
    )
  }

  function handleRoundSubmit(submission: unknown): void {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN || !roundContent) return
    setRoundSubmitted(true)
    socket.send(
      JSON.stringify({
        event: EVENTS.ROUND_SUBMIT,
        data: {
          roundId: roundContent.roundId,
          type: roundContent.type,
          submission,
          timestamp: Date.now(),
        },
      })
    )
  }

  function handleRoundProgress(submission: unknown): void {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN || !roundContent || roundSubmitted) return

    const payload: RoundProgressPayload = {
      roundId: roundContent.roundId,
      type: roundContent.type,
      submission,
      timestamp: Date.now(),
    }

    socket.send(
      JSON.stringify({
        event: EVENTS.ROUND_PROGRESS,
        data: payload,
      })
    )
  }

  function handleLeaveRoom(): void {
    intentionalCloseRef.current = true

    clearSavedPlayer()

    credsRef.current = null
    playerIdRef.current = null
    pendingJoinRef.current = null

    if (socketRef.current) {
      socketRef.current.close()
      socketRef.current = null
    }

    setJoined(false)
    setJoining(false)
    setRoomState(null)
    setRound(null)
    setQuestion(null)
    setReveal(null)
    setLeaderboard([])
    setFinalScores(null)
    setJoinError(null)
    setStatus('closed')
  }

  function selectOption(choiceId: string, submission: unknown): void {
    setSelectedOptionId(choiceId)
    handleRoundSubmit(submission)
  }

  function clearFatalError(): void {
    setFatalError(null)
    setJoinError(null)
  }

  return {
    status,
    joined,
    joining,
    roomState,
    round,
    question,
    secondsRemaining,
    selectedAnswerId,
    reveal,
    roundContent,
    roundReveal,
    leaderboard,
    finalScores,
    joinError,
    fatalError,
    reconnectExhausted,
    roundSubmitted,
    selectedOptionId,
    kicked,
    playerId: playerIdRef.current,
    creds: credsRef.current,
    handleJoin,
    handleAnswer,
    handleRoundSubmit,
    handleRoundProgress,
    handleLeaveRoom,
    selectOption,
    clearFatalError,
  }
}
