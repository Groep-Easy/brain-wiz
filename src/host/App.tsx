import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type {
  RoomState,
  LeaderboardEntry,
  RoadmapUpdate,
  ScoreMap,
  QuestionState,
  QuestionRevealPayload,
  RoundSummary,
  RoundContentPayload,
  RoundRevealPayload,
} from '@shared/types/index'
import { SetupLobby } from './components/SetupLobby'
import { Question } from './screens/Question'
import { LeaderBoard } from './components/LeaderBoard'
import { RoundIntro } from './screens/RoundIntro'
import { GameOver } from './screens/GameOver'
import * as EVENTS from '@shared/constants/socket-events.constants'
import { WS_SUBPROTOCOL } from '@shared/constants/ws.constants'
import { RoundMinigameSurface } from '@minigames/components/RoundMinigameSurface'
import { CountdownCircle } from '@shared/components/CountdownCircle'

import jazzMusic from '../shared/SFX/jazz.mp3'
import leaderboardMusic from '../shared/SFX/leaderboard.mp3'

import './styles/welcome.css'
import { getBackendHttpUrl, getBackendWsUrl } from '@shared/utils/env'

const BACKEND_WS_URL = getBackendWsUrl(import.meta.env.VITE_WS_URL)
const BACKEND_HTTP_URL = getBackendHttpUrl(BACKEND_WS_URL)

export function App(): React.JSX.Element {
  const { roomCode } = useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  const hostToken = sessionStorage.getItem(`hostToken_${roomCode}`)

  const [status, setStatus] = useState<'closed' | 'connecting' | 'open'>('closed')
  const [fatalError, setFatalError] = useState<string | null>(null)
  const [roomState, setRoomState] = useState<RoomState | null>(null)
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0)
  const [question, setQuestion] = useState<QuestionState | null>(null)
  const [reveal, setReveal] = useState<QuestionRevealPayload | null>(null)
  const [answeredCount, setAnsweredCount] = useState<number>(0)
  const [totalPlayers, setTotalPlayers] = useState<number>(0)
  const [round, setRound] = useState<RoundSummary | null>(null)
  const [roundContent, setRoundContent] = useState<RoundContentPayload | null>(null)
  const [roundReveal, setRoundReveal] = useState<RoundRevealPayload | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [roadmap, setRoadmap] = useState<RoadmapUpdate | null>(null)
  const [finalScores, setFinalScores] = useState<ScoreMap | null>(null)

  const socketRef = useRef<WebSocket | null>(null)

  // Disconnect on unmount
  useEffect(() => {
    return () => {
      socketRef.current?.close()
    }
  }, [])

  // Automatically connect WebSocket when roomCode and hostToken are set
  useEffect(() => {
    if (!roomCode || !hostToken) {
      setFatalError('Room taken or unauthorized')
      return
    }

    setStatus('connecting')

    const connectTimer = setTimeout(() => {
      const wsUrl = `${BACKEND_WS_URL}/?role=host&code=${roomCode}`
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
      setRoadmap(null)
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
            setRoundContent(null)
            setRoundReveal(null)
            break

          case EVENTS.TIMER_TICK:
            setSecondsRemaining(data.secondsRemaining)
            break

          case EVENTS.QUESTION_SHOW:
            if (data.question) {
              setRoundContent(null)
              setRoundReveal(null)
              setQuestion(data.question)
              setReveal(null)
              setAnsweredCount(0)
            }
            break

          case EVENTS.ROUND_CONTENT_SHOW:
            setRoundContent(data as RoundContentPayload)
            setRoundReveal(null)
            setAnsweredCount(0)
            break

          case EVENTS.ANSWER_COUNT_UPDATE:
            setAnsweredCount(data.answered)
            setTotalPlayers(data.total)
            break

          case EVENTS.QUESTION_REVEAL:
            setReveal(data)
            break

          case EVENTS.ROUND_REVEAL:
            setRoundReveal(data as RoundRevealPayload)
            break

          case EVENTS.LEADERBOARD_SHOW:
            if (data.leaderboard) {
              setLeaderboard(data.leaderboard)
            }
            break

          case EVENTS.ROADMAP_UPDATE:
            setRoadmap(data as RoadmapUpdate)
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

    socket.onclose = (event) => {
      setStatus('closed')
      setRoomState(null)
      if (event.code === 4004) {
        setFatalError('Room not found or token invalid')
      }
      // Do not clear tokens or code so we can attempt reconnect if desired
    }

    socket.onerror = () => {
      // eslint-disable-next-line no-console
      console.error('WebSocket connection error')
    }
    }, 50)

    return () => {
      clearTimeout(connectTimer)
      if (socketRef.current && socketRef.current.readyState === WebSocket.CONNECTING) {
        socketRef.current.onerror = null
      }
      socketRef.current?.close()
    }
  }, [roomCode, hostToken, navigate])

  const handleStartGame = async () => {
    if (!roomCode || !hostToken) return
    try {
      const res = await fetch(`${BACKEND_HTTP_URL}/rooms/${roomCode}/start`, {
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
      setRoomState(null)
      setStatus('closed')
      navigate('/')
    }
  }

  // Dynamic Routing based on game phase
  if (fatalError) {
    return (
      <main className="app">
        <div className="welcome-screen">
          <div className="welcome-card">
            <CountdownCircle
              seconds={5}
              message={fatalError}
              onComplete={() => navigate('/')}
            />
          </div>
        </div>
      </main>
    )
  }

  if (!roomState || status !== 'open') {
    return (
      <main className="app">
        <div className="welcome-screen">
          <div className="welcome-card">
            <p>Connecting to room {roomCode}...</p>
          </div>
        </div>
      </main>
    )
  }

  const phase = roomState.phase

  if (phase === 'lobby') {
    return (
      <main className="app">
        <audio id="bg-music" loop autoPlay src={jazzMusic} preload="auto"></audio>
        <SetupLobby
          roomCode={roomCode!}
          hostToken={hostToken!}
          players={roomState.players}
          gameFlow={roomState.gameFlow ?? []}
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
    if (roundContent) {
      return (
        <main className="app app--minigame">
          {renderMinigame(roundContent, roundReveal, phase === 'reveal' ? 'reveal' : 'playing')}
        </main>
      )
    }

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
        gameCode={roomCode!}
        question={question}
        secondsRemaining={secondsRemaining}
        answeredCount={answeredCount}
        totalPlayers={totalPlayers}
        reveal={phase === 'reveal' ? reveal : null}
      />
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

  if (phase === 'leaderboard') {
    return (
      <main className="app">
        <audio id="leaderboard-music" autoPlay src={leaderboardMusic} preload="auto"></audio>
        <LeaderBoard leaderboard={leaderboard} roadmap={roadmap} />
      </main>
    )
  }

  return (
    <main className="app">
      <h1>Unknown Phase: {phase}</h1>
    </main>
  )
}

function renderMinigame(
  content: RoundContentPayload,
  reveal: RoundRevealPayload | null,
  phase: 'playing' | 'reveal'
): React.JSX.Element {
  if (content.type === 'balance-scale' || content.type === 'sliding-puzzle') {
    return (
      <RoundMinigameSurface
        className={`host-minigame ${
          content.type === 'balance-scale' ? 'host-minigame--scale' : 'host-minigame--sliding'
        }`}
        content={content}
        mode="display"
        phase={phase}
        reveal={reveal}
      />
    )
  }

  return (
    <div className="welcome-screen">
      <div className="welcome-card">
        <p>Preparing next round...</p>
      </div>
    </div>
  )
}
