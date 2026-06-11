import { useEffect, useRef, useState } from 'react'
import type {
  RoomState,
  RoundSummary,
  QuestionState,
  QuestionRevealPayload,
  LeaderboardEntry,
  ScoreMap,
  GamePhase,
  PlayerJoinAckPayload,
  PlayerJoinRejectedPayload,
  AnswerAckPayload,
} from '../shared/types/index'
import * as EVENTS from '../shared/events/socket-events'
import { JoinScreen } from './components/JoinScreen'
import { Waiting } from './screens/Waiting'
import { RoundIntro } from './screens/RoundIntro'
import { Answer } from './screens/Answer'
import { Leaderboard } from './screens/Leaderboard'
import { GameOver } from './screens/GameOver'
import { LoadingComp } from './components/LoadingComp'
import './styles/main_style.css'

const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
const defaultWsUrl = typeof window !== 'undefined' 
  ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}` 
  : 'ws://localhost:3000'

const BACKEND_WS_URL = import.meta.env.VITE_WS_URL || (isLocalhost ? 'ws://localhost:3000' : defaultWsUrl)
const STORAGE_KEY = 'brainwiz-player'
const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_DELAY_MS = 1500

interface SavedPlayer {
  roomCode: string
  playerName: string
  playerId: string
  reconnectToken: string
}

function loadSavedPlayer(): SavedPlayer | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SavedPlayer>
    if (parsed.roomCode && parsed.playerName && parsed.playerId && parsed.reconnectToken) {
      return {
        roomCode: parsed.roomCode,
        playerName: parsed.playerName,
        playerId: parsed.playerId,
        reconnectToken: parsed.reconnectToken,
      }
    }
    return null
  } catch {
    return null
  }
}

function readCodeFromUrl(): string {
  const params = new URLSearchParams(window.location.search)
  return params.get('code')?.toUpperCase() ?? ''
}

export function App(): React.JSX.Element {
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed'>('connecting')
  const [joined, setJoined] = useState(false)
  const [joining, setJoining] = useState<boolean>(() => loadSavedPlayer() !== null)
  const [roomState, setRoomState] = useState<RoomState | null>(null)
  const [round, setRound] = useState<RoundSummary | null>(null)
  const [question, setQuestion] = useState<QuestionState | null>(null)
  const [secondsRemaining, setSecondsRemaining] = useState(0)
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null)
  const [reveal, setReveal] = useState<QuestionRevealPayload | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [finalScores, setFinalScores] = useState<ScoreMap | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [reconnectExhausted, setReconnectExhausted] = useState(false)

  const socketRef = useRef<WebSocket | null>(null)
  const playerIdRef = useRef<string | null>(null)
  const credsRef = useRef<SavedPlayer | null>(loadSavedPlayer())
  const pendingJoinRef = useRef<{ name: string; code: string } | null>(null)
  const intentionalCloseRef = useRef(false)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [urlCode] = useState(readCodeFromUrl)

  function sendJoin(name: string, code: string, creds: SavedPlayer | null): void {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    socket.send(
      JSON.stringify({
        event: EVENTS.PLAYER_JOIN,
        data: {
          roomCode: code,
          playerName: name,
          ...(creds ? { playerId: creds.playerId, playerToken: creds.reconnectToken } : {}),
        },
      })
    )
  }

  function handleEvent(ev: string, data: any): void {
    switch (ev) {
      case EVENTS.PLAYER_JOIN_ACK: {
        const ack = data as PlayerJoinAckPayload
        playerIdRef.current = ack.playerId
        const creds: SavedPlayer = {
          roomCode: ack.roomCode,
          playerName: credsRef.current?.playerName ?? pendingJoinRef.current?.name ?? '',
          playerId: ack.playerId,
          reconnectToken: ack.reconnectToken,
        }
        credsRef.current = creds
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(creds))
        } catch {
          /* ignore storage errors (private mode, quota) */
        }
        pendingJoinRef.current = null
        setJoinError(null)
        setJoining(false)
        setJoined(true)
        break
      }
      case EVENTS.PLAYER_JOIN_REJECTED: {
        const rejected = data as PlayerJoinRejectedPayload
        credsRef.current = null
        try {
          localStorage.removeItem(STORAGE_KEY)
        } catch {
          /* ignore */
        }
        setJoining(false)
        setJoined(false)
        setJoinError(rejected.reason || 'Could not join the room.')
        break
      }
      case EVENTS.ROOM_STATE_UPDATE:
        setRoomState(data.room as RoomState)
        break
      case EVENTS.GAME_PHASE_CHANGE:
        setRoomState((prev) => (prev ? { ...prev, phase: data.phase as GamePhase } : prev))
        break
      case EVENTS.ROUND_START:
        if (data.round) setRound(data.round as RoundSummary)
        break
      case EVENTS.TIMER_TICK:
        setSecondsRemaining(data.secondsRemaining as number)
        break
      case EVENTS.QUESTION_SHOW:
        if (data.question) {
          setQuestion(data.question as QuestionState)
          setReveal(null)
          setSelectedAnswerId(null)
        }
        break
      case EVENTS.QUESTION_REVEAL:
        setReveal(data as QuestionRevealPayload)
        break
      case EVENTS.LEADERBOARD_SHOW:
        if (data.leaderboard) setLeaderboard(data.leaderboard as LeaderboardEntry[])
        break
      case EVENTS.GAME_OVER:
        if (data.finalScores) setFinalScores(data.finalScores as ScoreMap)
        break
      case EVENTS.ANSWER_ACK: {
        const ack = data as AnswerAckPayload
        if (!ack.accepted && (ack.reason === 'server-error' || ack.reason === 'invalid-answer')) {
          setSelectedAnswerId(null)
        }
        break
      }
      default:
        break
    }
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
        sendJoin(creds.playerName, creds.roomCode, creds)
      } else if (pendingJoinRef.current) {
        sendJoin(pendingJoinRef.current.name, pendingJoinRef.current.code, null)
      }
    }

    socket.onmessage = (event) => {
      if (socketRef.current !== socket) return
      try {
        const { event: ev, data } = JSON.parse(event.data) as { event: string; data: any }
        handleEvent(ev, data)
      } catch (err) {
        // eslint-disable-next-line no-console
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
      // eslint-disable-next-line no-console
      console.error('WebSocket connection error')
    }
  }

  useEffect(() => {
    connect()
    return () => {
      intentionalCloseRef.current = true
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      socketRef.current?.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleJoin(name: string, code: string): void {
    setJoinError(null)
    setJoining(true)
    const socket = socketRef.current
    if (socket && socket.readyState === WebSocket.OPEN) {
      sendJoin(name, code, null)
    } else {
      pendingJoinRef.current = { name, code }
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

  const disconnected = status === 'closed'
  const banner = disconnected ? (
    <div className="banner">
      {reconnectExhausted ? 'Connection lost — reload the page to rejoin' : 'Reconnecting…'}
    </div>
  ) : null

  if (!joined) {
    if (joining) {
      return (
        <main className="app">
          {banner}
          <LoadingComp />
        </main>
      )
    }
    return (
      <main className="app">
        {banner}
        <JoinScreen
          initialCode={credsRef.current?.roomCode || urlCode}
          error={joinError}
          onJoin={handleJoin}
        />
      </main>
    )
  }

  const phase: GamePhase = roomState?.phase ?? 'lobby'
  const myPlayerId = playerIdRef.current

  if (phase === 'lobby') {
    return (
      <main className="app">
        {banner}
        <Waiting
          playerName={credsRef.current?.playerName ?? ''}
          roomCode={credsRef.current?.roomCode ?? ''}
        />
      </main>
    )
  }

  if (phase === 'round-intro') {
    return (
      <main className="app">
        {banner}
        <RoundIntro index={round?.index ?? roomState?.round ?? 1} total={round?.total ?? 0} />
      </main>
    )
  }

  if (phase === 'playing' || phase === 'reveal') {
    if (!question) {
      return (
        <main className="app">
          {banner}
          <div className="card">
            <h2>Preparing next question…</h2>
          </div>
        </main>
      )
    }
    const myResult = reveal && myPlayerId ? (reveal.playerAnswers[myPlayerId] ?? null) : null
    return (
      <main className="app">
        {banner}
        <Answer
          question={question}
          selectedAnswerId={selectedAnswerId}
          phase={phase === 'reveal' ? 'reveal' : 'playing'}
          result={myResult}
          correctAnswerIds={reveal?.correctAnswerIds ?? []}
          secondsRemaining={secondsRemaining}
          onAnswer={handleAnswer}
        />
      </main>
    )
  }

  if (phase === 'leaderboard') {
    return (
      <main className="app">
        {banner}
        <Leaderboard leaderboard={leaderboard} myPlayerId={myPlayerId} />
      </main>
    )
  }

  if (phase === 'game-over' || finalScores !== null) {
    return (
      <main className="app">
        {banner}
        <GameOver
          players={roomState?.players ?? []}
          finalScores={finalScores ?? {}}
          myPlayerId={myPlayerId}
        />
      </main>
    )
  }

  return (
    <main className="app">
      {banner}
      <div className="card">
        <h2>Loading…</h2>
      </div>
    </main>
  )
}
