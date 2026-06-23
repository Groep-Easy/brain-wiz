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
} from '@brain-wiz/shared/types/index'
import { SetupLobby } from './components/SetupLobby'
import { Question } from './screens/Question'
import { LeaderBoard } from './components/LeaderBoard'
import { RoundIntro } from './screens/RoundIntro'
import { GameOver } from './screens/GameOver'
import * as EVENTS from '@brain-wiz/shared/constants/socket-events.constants'
import { WS_SUBPROTOCOL } from '@brain-wiz/shared/constants/ws.constants'
import { RoundMinigameSurface } from '@brain-wiz/minigames/components/RoundMinigameSurface'
import { CountdownCircle } from '@brain-wiz/shared/components/CountdownCircle'

import { WelcomeScreen } from './screens/WelcomeScreen'
import { ConfirmDialog } from '@brain-wiz/shared/components/ConfirmDialog'
import './styles/welcome.css'
import { getBackendHttpUrl, getBackendWsUrl } from '@brain-wiz/shared/utils/env'

import { MuteButton } from '@brain-wiz/shared/components/MuteButton'

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
  const [confirmCloseOpen, setConfirmCloseOpen] = useState<boolean>(false)

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
          const { event: ev, data } = JSON.parse(event.data) as {
            event: string
            data: unknown
          }

          // data is `unknown` — cast locally per-case for type-safe access
          const d = data as Record<string, unknown>

          switch (ev) {
            case EVENTS.ROOM_STATE_UPDATE:
              setRoomState(d.room as RoomState)
              break

            case EVENTS.GAME_PHASE_CHANGE:
              setRoomState((prev: RoomState | null) =>
                prev ? { ...prev, phase: d.phase as RoomState['phase'] } : prev
              )
              break

            case EVENTS.ROUND_START:
              if (d.round) {
                setRound(d.round as RoundSummary)
              }
              setRoundContent(null)
              setRoundReveal(null)
              break

            case EVENTS.TIMER_TICK:
              setSecondsRemaining(d.secondsRemaining as number)
              break

            case EVENTS.QUESTION_SHOW:
              if (d.question) {
                setRoundContent(null)
                setRoundReveal(null)
                setQuestion(d.question as QuestionState)
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
              setAnsweredCount(d.answered as number)
              setTotalPlayers(d.total as number)
              break

            case EVENTS.QUESTION_REVEAL:
              setReveal(data as QuestionRevealPayload)
              break

            case EVENTS.ROUND_REVEAL:
              setRoundReveal(data as RoundRevealPayload)
              break

            case EVENTS.LEADERBOARD_SHOW:
              if (d.leaderboard) {
                setLeaderboard(d.leaderboard as LeaderboardEntry[])
              }
              break

            case EVENTS.ROADMAP_UPDATE:
              setRoadmap(data as RoadmapUpdate)
              break

            case EVENTS.GAME_OVER:
              if (d.finalScores) {
                setFinalScores(d.finalScores as ScoreMap)
              }
              break

            default:
              break
          }
        } catch (err) {
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
        console.error(`Failed to start game: ${errorText}`)
        return
      }
    } catch {
      console.error(`needs at least 2 players`)
    }
  }

  const handleCloseLobby = () => {
    setConfirmCloseOpen(true)
  }

  const performCloseLobby = () => {
    setConfirmCloseOpen(false)
    socketRef.current?.close()
    socketRef.current = null
    setRoomState(null)
    setStatus('closed')
    void navigate('/')
  }

  const renderPhase = () => {
    if (fatalError) {
      return (
        <main className="app">
          <div className="welcome-screen">
            <div className="welcome-card">
              <CountdownCircle
                seconds={5}
                message={fatalError}
                onComplete={async () => navigate('/')}
              />
            </div>
          </div>
        </main>
      )
    }

    if (!roomState || status !== 'open' || !roomCode || !hostToken) {
      return <WelcomeScreen />
    }

    const phase = roomState.phase

    if (phase === 'lobby') {
      return (
        <main className="app app--lobby">
          <SetupLobby
            roomCode={roomCode}
            hostToken={hostToken}
            players={roomState.players}
            gameFlow={roomState.gameFlow ?? []}
            onStartGame={handleStartGame}
            onCloseLobby={handleCloseLobby}
          />
        </main>
      )
    }

    if (phase === 'round-intro') {
      return (
        <RoundIntro
          index={round?.index ?? roomState.round}
          total={round?.total ?? 0}
          questionText={round?.questionText}
        />
      )
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
          gameCode={roomCode}
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
        <main className="app app--solid">
          <LeaderBoard leaderboard={leaderboard} roadmap={roadmap} players={roomState.players} />
        </main>
      )
    }

    return (
      <main className="app">
        <h1>Unknown Phase: {phase}</h1>
      </main>
    )
  }

  return (
    <>
      {renderPhase()}
      {roomState?.phase && roomState.phase !== 'lobby' && <MuteButton />}
      <ConfirmDialog
        open={confirmCloseOpen}
        title="Dissolve lobby?"
        message="This will close the room and disconnect all players."
        confirmLabel="Dissolve"
        cancelLabel="Cancel"
        danger
        onConfirm={performCloseLobby}
        onCancel={() => setConfirmCloseOpen(false)}
      />
    </>
  )
}

function renderMinigame(
  content: RoundContentPayload,
  reveal: RoundRevealPayload | null,
  phase: 'playing' | 'reveal'
): React.JSX.Element {
  if (
    content.type === 'balance-scale' ||
    content.type === 'sliding-puzzle' ||
    content.type === 'vault-rush'
  ) {
    return (
      <RoundMinigameSurface
        className={`host-minigame ${content.type === 'balance-scale'
          ? 'host-minigame--scale'
          : content.type === 'vault-rush'
            ? 'host-minigame--vault'
            : 'host-minigame--sliding'
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
