/**
 * @file Console.tsx
 * @owner host-squad
 * @description Throwaway WebSocket debug console, served at /console.
 *
 * NOT a real host UI — it's a manual test client for the server team, kept off
 * the host root (/) so it doesn't collide with the host team's work. As the
 * HOST it can create a room (POST /rooms), connect read-only over WS
 * (?role=host&code&hostToken) and start the game (POST /rooms/:code/start), so
 * you can drive the host→server lobby flow by hand. It also logs every frame it
 * receives and can fire arbitrary `{ event, data }` frames.
 */
import { useRef, useState } from 'react'
import {
  LEADERBOARD_SHOW,
  PING,
  QUESTION_REVEAL,
  QUESTION_SHOW,
} from '../../shared/events/socket-events'
import { WS_SUBPROTOCOL } from '../../shared/constants/ws'
import type {
  LeaderboardEntry,
  LeaderboardShowPayload,
  QuestionRevealPayload,
  QuestionShowPayload,
  QuestionState,
} from '../../shared/types'
import {
  buildWsUrl,
  parseFrame,
  parsePayload,
  rttNote,
  wsToHttp,
  type Direction,
  type LogEntry,
  type Status,
} from './console-utils'
import './console.css'

const DEFAULT_URL = 'ws://localhost:3000'

function rankDelta(entry: LeaderboardEntry): string {
  if (entry.previousRank === null) {
    return 'new'
  }
  if (entry.rankChange > 0) {
    return `▲${entry.rankChange}`
  }
  if (entry.rankChange < 0) {
    return `▼${-entry.rankChange}`
  }
  return '—'
}

export function Console(): React.JSX.Element {
  const [url, setUrl] = useState(DEFAULT_URL)
  const [status, setStatus] = useState<Status>('closed')
  const [log, setLog] = useState<LogEntry[]>([])
  const [eventName, setEventName] = useState<string>(PING)
  const [payload, setPayload] = useState('{}')
  const [code, setCode] = useState('')
  const [hostToken, setHostToken] = useState('')
  const [question, setQuestion] = useState<QuestionState | null>(null)
  const [reveal, setReveal] = useState<QuestionRevealPayload | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null>(null)

  const socketRef = useRef<WebSocket | null>(null)
  const idRef = useRef(0)

  function append(dir: Direction, text: string): void {
    idRef.current += 1
    const entry: LogEntry = {
      id: idRef.current,
      dir,
      text,
      time: new Date().toLocaleTimeString(),
    }
    setLog((prev) => [entry, ...prev])
  }

  /** Mirror the question/reveal flow onto the host's big-screen view. */
  function capture(raw: string): void {
    const frame = parseFrame(raw)
    if (!frame) {
      return
    }
    if (frame.event === QUESTION_SHOW) {
      setQuestion((frame.data as QuestionShowPayload).question)
      setReveal(null)
    } else if (frame.event === QUESTION_REVEAL) {
      setReveal(frame.data as QuestionRevealPayload)
    } else if (frame.event === LEADERBOARD_SHOW) {
      setLeaderboard((frame.data as LeaderboardShowPayload).leaderboard)
    }
  }

  function connect(target: string, protocols?: string[]): void {
    socketRef.current?.close()
    append('info', `connecting to ${target}…`)
    setStatus('connecting')

    const socket = protocols ? new WebSocket(target, protocols) : new WebSocket(target)
    socketRef.current = socket
    socket.onopen = (): void => {
      setStatus('open')
      append('info', 'connection open')
    }
    socket.onmessage = (event): void => {
      const raw = String(event.data)
      append('in', raw + rttNote(raw))
      capture(raw)
    }
    socket.onclose = (): void => {
      setStatus('closed')
      append('info', 'connection closed')
    }
    socket.onerror = (): void => {
      append('info', 'connection error')
    }
  }

  function disconnect(): void {
    socketRef.current?.close()
    socketRef.current = null
  }

  function send(event: string, rawData: string): void {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      append('info', 'cannot send — not connected')
      return
    }
    const frame = JSON.stringify({ event, data: parsePayload(rawData) })
    socket.send(frame)
    append('out', frame)
  }

  async function createRoom(): Promise<void> {
    try {
      const res = await fetch(`${wsToHttp(url)}/rooms`, { method: 'POST' })
      if (!res.ok) {
        append('info', `create room failed: HTTP ${res.status}`)
        return
      }
      const body = (await res.json()) as { code: string; hostToken: string }
      setCode(body.code)
      setHostToken(body.hostToken)
      append('info', `room created — code ${body.code}, hostToken ${body.hostToken}`)
    } catch (error) {
      append('info', `create room error: ${String(error)}`)
    }
  }

  function connectAsHost(): void {
    if (!code || !hostToken) {
      append('info', 'create a room first')
      return
    }
    connect(buildWsUrl(url, { role: 'host', code }), [WS_SUBPROTOCOL, hostToken])
  }

  async function startGame(): Promise<void> {
    if (!code) {
      append('info', 'no room to start — create one first')
      return
    }
    try {
      const res = await fetch(`${wsToHttp(url)}/rooms/${code}/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ hostToken }),
      })
      if (!res.ok) {
        append('info', `start game failed: HTTP ${res.status}`)
        return
      }
      append('info', 'game started')
    } catch (error) {
      append('info', `start game error: ${String(error)}`)
    }
  }

  return (
    <main className="console">
      <h1>Host WebSocket debug console</h1>

      <section className="row">
        <input
          aria-label="server url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={status !== 'closed'}
        />
        {status === 'closed' ? (
          <button onClick={() => connect(url)}>Connect</button>
        ) : (
          <button onClick={disconnect}>Disconnect</button>
        )}
        <span className="status" data-status={status}>
          {status}
        </span>
      </section>

      <section className="row">
        <button onClick={() => void createRoom()}>Create room</button>
        <input
          aria-label="room code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="code"
        />
        <button onClick={connectAsHost} disabled={!code || !hostToken}>
          Connect as host
        </button>
        <button onClick={() => void startGame()} disabled={!code}>
          Start game
        </button>
      </section>

      <section className="row">
        <button onClick={() => send(PING, JSON.stringify({ t: Date.now() }))}>Ping</button>
        <input
          aria-label="event name"
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
          placeholder="EVENT_NAME"
        />
        <input
          aria-label="payload"
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          placeholder='{"key":"value"}'
        />
        <button onClick={() => send(eventName, payload)}>Send</button>
        <button onClick={() => setLog([])}>Clear</button>
      </section>

      {question && (
        <section className="question">
          <p className="question-text">{question.text}</p>
          <div className="row">
            {question.answers.map((answer) => {
              const correct = reveal?.correctAnswerIds.includes(answer.id) ?? false
              return (
                <span
                  key={answer.id}
                  className="answer-chip"
                  data-correct={correct ? 'true' : undefined}
                >
                  {answer.text}
                  {correct ? ' ✓' : ''}
                </span>
              )
            })}
          </div>
          {reveal && (
            <ul className="reveal-players">
              {Object.entries(reveal.playerAnswers).map(([playerId, result]) => (
                <li key={playerId}>
                  <code>{playerId}</code> —{' '}
                  {result.isTimeout
                    ? 'timed out'
                    : `${result.isCorrect ? 'correct' : 'wrong'}, ${result.pointsAwarded} pts`}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {leaderboard && (
        <section className="leaderboard">
          <h2>Leaderboard</h2>
          <ol className="leaderboard-list">
            {leaderboard.map((entry) => (
              <li key={entry.playerId} data-offline={entry.connected ? undefined : 'true'}>
                <span className="lb-rank">{entry.rank}</span>
                <span className="lb-name">
                  {entry.name}
                  {entry.connected ? '' : ' (offline)'}
                </span>
                <span className="lb-score">{entry.score}</span>
                <span className="lb-delta">{rankDelta(entry)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <ul className="log">
        {log.map((entry) => (
          <li key={entry.id} className={`log-${entry.dir}`}>
            <span className="log-time">{entry.time}</span>
            <span className="log-dir">
              {entry.dir === 'in' ? '↓' : entry.dir === 'out' ? '↑' : '•'}
            </span>
            <code>{entry.text}</code>
          </li>
        ))}
      </ul>
    </main>
  )
}
