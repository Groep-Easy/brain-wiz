import { useEffect, useRef, useState } from 'react'
import type {
  RoomState,
  LeaderboardEntry,
  ScoreMap,
  QuestionState,
  QuestionRevealPayload,
  RoundSummary,
} from '../shared/types/index'
import { SetupLobby } from './components/SetupLobby'
import { Question } from './screens/Question'
import { LeaderBoard } from './components/LeaderBoard'
import { RoundIntro } from './screens/RoundIntro'
import { GameOver } from './screens/GameOver'
import * as EVENTS from '../shared/events/socket-events'
import { WS_SUBPROTOCOL } from '../shared/constants/ws'
import './styles/index.css'
import './styles/welcome.css'
import './styles/main_style.css'


const BACKEND_WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000'
const BACKEND_HTTP_URL = BACKEND_WS_URL.replace(/^ws/i, 'http')

export function App(): React.JSX.Element {
  const [code, setCode] = useState<string>('')
  const [hostToken, setHostToken] = useState<string>('')
  const [status, setStatus] = useState<'closed' | 'connecting' | 'open'>('closed')
  const [roomState, setRoomState] = useState<RoomState | null>(null)
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0)
  const [question, setQuestion] = useState<QuestionState | null>(null)
  const [reveal, setReveal] = useState<QuestionRevealPayload | null>(null)
  const [answeredCount, setAnsweredCount] = useState<number>(0)
  const [totalPlayers, setTotalPlayers] = useState<number>(0)
  const [round, setRound] = useState<RoundSummary | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [finalScores, setFinalScores] = useState<ScoreMap | null>(null)

  const socketRef = useRef<WebSocket | null>(null)

  // Disconnect on unmount
  useEffect(() => {
    return () => {
      socketRef.current?.close()
    }
  }, [])

  // Automatically connect WebSocket when code and hostToken are set
  useEffect(() => {
    if (!code || !hostToken) return

    socketRef.current?.close()
    setStatus('connecting')

    const wsUrl = `${BACKEND_WS_URL}/?role=host&code=${code}`
    const socket = new WebSocket(wsUrl, [WS_SUBPROTOCOL, hostToken])
    socketRef.current = socket

    socket.onopen = () => {
      setStatus('open')
      // Reset game states
      setQuestion(null)
      setReveal(null)
      setAnsweredCount(0)
      setTotalPlayers(0)
      setRound(null)
      setLeaderboard([])
      setFinalScores(null)
    }

    socket.onmessage = (event) => {
      try {
        const { event: ev, data } = JSON.parse(event.data) as { event: string; data: any }

        switch (ev) {
          case EVENTS.ROOM_STATE_UPDATE:
            setRoomState(data.room)
            break

          case EVENTS.GAME_PHASE_CHANGE:
            setRoomState((prev) => (prev ? { ...prev, phase: data.phase } : prev))
            break

          case EVENTS.ROUND_START:
            if (data.round) {
              setRound(data.round)
            }
            break

          case EVENTS.TIMER_TICK:
            setSecondsRemaining(data.secondsRemaining)
            break

          case EVENTS.QUESTION_SHOW:
            if (data.question) {
              setQuestion(data.question)
              setReveal(null)
              setAnsweredCount(0)
            }
            break

          case EVENTS.ANSWER_COUNT_UPDATE:
            setAnsweredCount(data.answered)
            setTotalPlayers(data.total)
            break

          case EVENTS.QUESTION_REVEAL:
            setReveal(data)
            break

          case EVENTS.LEADERBOARD_SHOW:
            if (data.leaderboard) {
              setLeaderboard(data.leaderboard)
            }
            break

          case EVENTS.GAME_OVER:
            if (data.finalScores) {
              setFinalScores(data.finalScores)
            }
            break

          default:
            break
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to parse WebSocket message:', err)
      }
    }

    socket.onclose = () => {
      setStatus('closed')
      setRoomState(null)
      setCode('')
      setHostToken('')
    }

    socket.onerror = () => {
      // eslint-disable-next-line no-console
      console.error('WebSocket connection error')
    }
  }, [code, hostToken])

  const handleCreateRoom = async () => {
    try {
      const res = await fetch(`${BACKEND_HTTP_URL}/rooms`, { method: 'POST' })
      if (!res.ok) {
        alert('Failed to create room on server')
        return
      }
      const body = (await res.json()) as { code: string; hostToken: string }
      setCode(body.code)
      setHostToken(body.hostToken)
    } catch (err) {
      alert(`Error creating room: ${String(err)}`)
    }
  }

  const handleStartGame = async () => {
    if (!code || !hostToken) return
    try {
      const res = await fetch(`${BACKEND_HTTP_URL}/rooms/${code}/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ hostToken }),
      })
      if (!res.ok) {
        const errorText = await res.text()
        alert(`Failed to start game: ${errorText}`)
        return
      }
    } catch (err) {
      alert(`Error starting game: ${String(err)}`)
    }
  }

  const handleCloseLobby = () => {
    if (window.confirm('Are you sure you want to dissolve the lobby?')) {
      socketRef.current?.close()
      socketRef.current = null
      setCode('')
      setHostToken('')
      setRoomState(null)
      setStatus('closed')
    }
  }

  // Dynamic Routing based on game phase
  if (!roomState || status !== 'open') {
    return (
      <main className="app">
        <div className="welcome-screen">
          <div className="welcome-card">
            <h1>Brain Wiz</h1>
            <p className="subtitle">Interactive Quiz & Trivia Game</p>
            <div className="divider"></div>
            {status === 'connecting' ? (
              <p>Connecting to server...</p>
            ) : (
              <button className="primary-btn" onClick={handleCreateRoom}>
                Host Game
              </button>
            )}
          </div>
        </div>
      </main>
    )
  }

  const phase = roomState.phase

  if (phase === 'lobby') {
    return (
      <main className="app">
        <SetupLobby
          roomCode={code}
          players={roomState.players}
          onStartGame={handleStartGame}
          onCloseLobby={handleCloseLobby}
        />
      </main>
    )
  }

  if (phase === 'round-intro') {
    return <RoundIntro index={round?.index ?? roomState.round} total={round?.total ?? 0} />
  }

  if (phase === 'playing' || phase === 'reveal') {
    if (!question) {
      return (
        <main className="app">
          <div className="welcome-screen">
            <div className="welcome-card">
              <p>Preparing next question…</p>
            </div>
          </div>
        </main>
      )
    }
    return (
      <Question
        gameCode={code}
        question={question}
        secondsRemaining={secondsRemaining}
        answeredCount={answeredCount}
        totalPlayers={totalPlayers}
        reveal={phase === 'reveal' ? reveal : null}
      />
    )
  }

  if (phase === 'leaderboard') {
    return (
      <main className="app">
        <LeaderBoard leaderboard={leaderboard} />
      </main>
    )
  }

  if (phase === 'game-over' || finalScores !== null) {
    return (
      <GameOver
        players={roomState.players}
        finalScores={finalScores || {}}
        onBackToMenu={handleCloseLobby}
      />
    )
  }

  return (
    <main className="app">
      <h1>Unknown Phase: {phase}</h1>
    </main>
  )
}
