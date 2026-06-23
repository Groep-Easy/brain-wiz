import { useEffect, useRef, useState } from 'react'
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
import * as EVENTS from '@brain-wiz/shared/constants/socket-events.constants'
import { WS_SUBPROTOCOL } from '@brain-wiz/shared/constants/ws.constants'
import { getBackendHttpUrl, getBackendWsUrl } from '@brain-wiz/shared/utils/env'

const BACKEND_WS_URL = getBackendWsUrl(import.meta.env.VITE_WS_URL)
const BACKEND_HTTP_URL = getBackendHttpUrl(BACKEND_WS_URL)
const CONNECT_DELAY_MS = 50

/**
 * Owns the host WebSocket: it connects for a given room/token, translates
 * inbound events into React state, and exposes actions to start the game or
 * tear the connection down. The screen layer only renders the returned state.
 */
export function useHostSocket(roomCode: string | undefined, hostToken: string | null) {
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

  useEffect(() => {
    if (!roomCode || !hostToken) {
      setFatalError('Room taken or unauthorized')
      return
    }

    const resetGameState = (): void => {
      setQuestion(null)
      setReveal(null)
      setAnsweredCount(0)
      setTotalPlayers(0)
      setRound(null)
      setLeaderboard([])
      setRoadmap(null)
      setFinalScores(null)
    }

    const handlers: Record<string, (d: Record<string, unknown>, raw: unknown) => void> = {
      [EVENTS.ROOM_STATE_UPDATE]: (d) => setRoomState(d.room as RoomState),
      [EVENTS.GAME_PHASE_CHANGE]: (d) =>
        setRoomState((prev) => (prev ? { ...prev, phase: d.phase as RoomState['phase'] } : prev)),
      [EVENTS.ROUND_START]: (d) => {
        if (d.round) setRound(d.round as RoundSummary)
        setRoundContent(null)
        setRoundReveal(null)
      },
      [EVENTS.TIMER_TICK]: (d) => setSecondsRemaining(d.secondsRemaining as number),
      [EVENTS.QUESTION_SHOW]: (d) => {
        if (d.question) {
          setRoundContent(null)
          setRoundReveal(null)
          setQuestion(d.question as QuestionState)
          setReveal(null)
          setAnsweredCount(0)
        }
      },
      [EVENTS.ROUND_CONTENT_SHOW]: (_d, raw) => {
        setRoundContent(raw as RoundContentPayload)
        setRoundReveal(null)
        setAnsweredCount(0)
      },
      [EVENTS.ANSWER_COUNT_UPDATE]: (d) => {
        setAnsweredCount(d.answered as number)
        setTotalPlayers(d.total as number)
      },
      [EVENTS.QUESTION_REVEAL]: (_d, raw) => setReveal(raw as QuestionRevealPayload),
      [EVENTS.ROUND_REVEAL]: (_d, raw) => setRoundReveal(raw as RoundRevealPayload),
      [EVENTS.LEADERBOARD_SHOW]: (d) => {
        if (d.leaderboard) setLeaderboard(d.leaderboard as LeaderboardEntry[])
      },
      [EVENTS.ROADMAP_UPDATE]: (_d, raw) => setRoadmap(raw as RoadmapUpdate),
      [EVENTS.GAME_OVER]: (d) => {
        if (d.finalScores) setFinalScores(d.finalScores as ScoreMap)
      },
    }

    setStatus('connecting')

    const connectTimer = setTimeout(() => {
      const wsUrl = `${BACKEND_WS_URL}/?role=host&code=${roomCode}`
      const socket = new WebSocket(wsUrl, [WS_SUBPROTOCOL, hostToken])
      socketRef.current = socket

      socket.onopen = () => {
        setStatus('open')
        resetGameState()
      }

      socket.onmessage = (event) => {
        try {
          const { event: ev, data } = JSON.parse(event.data) as {
            event: string
            data: unknown
          }
          // data is `unknown` — cast locally per-case for type-safe access
          const d = data as Record<string, unknown>
          handlers[ev]?.(d, data)
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
    setRoomState(null)
    setStatus('closed')
  }

  return {
    status,
    fatalError,
    roomState,
    secondsRemaining,
    question,
    reveal,
    answeredCount,
    totalPlayers,
    round,
    roundContent,
    roundReveal,
    leaderboard,
    roadmap,
    finalScores,
    handleStartGame,
    closeConnection,
  }
}
