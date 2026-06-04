import { useEffect, useRef, useState } from 'react'
import type { Player, RoomState, LeaderboardEntry, ScoreMap } from '../shared/types/index'
import { SetupLobby } from './components/SetupLobby'
import { Question } from './screens/question'
import { LeaderBoard } from './components/LeaderBoard'
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
  const [currentQuestion, setCurrentQuestion] = useState<string>('')
  const [currentAnswers, setCurrentAnswers] = useState<string[]>([])
  const [amountAnswers, setAmountAnswers] = useState<number>(0)
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
      setCurrentQuestion('')
      setCurrentAnswers([])
      setAmountAnswers(0)
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
            if (roomState) {
              setRoomState({ ...roomState, phase: data.phase })
            }
            break

          case EVENTS.TIMER_TICK:
            setSecondsRemaining(data.secondsRemaining)
            break

          case EVENTS.QUESTION_SHOW:
            if (data.question) {
              setCurrentQuestion(data.question.text)
              setCurrentAnswers(data.question.answers.map((a: { text: string }) => a.text))
              setAmountAnswers(0)
            }
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

  if (phase === 'round-intro' || phase === 'playing' || phase === 'reveal') {
    return (
      <Question
        gameCode={code}
        theme="General Knowledge" // Fallback theme text, can be dynamic later
        currentQuestion={currentQuestion || 'Preparing next question...'}
        answers={currentAnswers}
        amountAnswers={amountAnswers}
        timer={secondsRemaining}
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
    // Map final scores to sorted entries
    const playersMap = new Map(roomState.players.map((p) => [p.id, p.name]))
    const sortedScores = Object.entries(finalScores || {})
      .map(([playerId, score]) => ({
        playerId,
        name: playersMap.get(playerId) || 'Unknown Player',
        score,
      }))
      .sort((a, b) => b.score - a.score)

    return (
      <main className="app">
        <div className="game-over-screen">
          <div className="game-over-card">
            <h1>Game Over</h1>
            <p className="subtitle">Final Standings</p>
            <div className="divider"></div>
            <ul className="final-scores-list">
              {sortedScores.map((score, index) => (
                <li key={score.playerId} className={`final-score-item ${index === 0 ? 'winner' : ''}`}>
                  <span>
                    #{index + 1} {score.name}
                  </span>
                  <span>{score.score} pts</span>
                </li>
              ))}
            </ul>
            <button className="primary-btn" onClick={handleCloseLobby}>
              Back to Main Menu
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="app">
      <h1>Unknown Phase: {phase}</h1>
    </main>
  )
}
