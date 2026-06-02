/**
 * @file Console.tsx
 * @owner client-squad
 * @description Throwaway WebSocket debug console for the phone client, served at
 * /console. Mirrors the host console but exposes the CLIENT side of the lobby
 * flow: connect + join a room (PLAYER_JOIN), leave (PLAYER_LEAVE) and reconnect
 * (re-join with the stored playerId, to exercise the server's grace window). It
 * also logs every frame and can fire arbitrary `{ event, data }` frames.
 */
import { useRef, useState } from 'react'
import { PING, PLAYER_JOIN, PLAYER_JOIN_ACK, PLAYER_LEAVE } from '../../shared/events/socket-events'
import { parsePayload, rttNote, type Direction, type LogEntry, type Status } from './console-utils'
import './console.css'

const DEFAULT_URL = 'ws://localhost:3000'

export function Console(): React.JSX.Element {
  const [url, setUrl] = useState(DEFAULT_URL)
  const [status, setStatus] = useState<Status>('closed')
  const [log, setLog] = useState<LogEntry[]>([])
  const [eventName, setEventName] = useState<string>(PING)
  const [payload, setPayload] = useState('{}')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')

  const socketRef = useRef<WebSocket | null>(null)
  const idRef = useRef(0)
  const playerIdRef = useRef<string | null>(null)

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

  function capturePlayerId(raw: string): void {
    try {
      const frame = JSON.parse(raw) as { event?: string; data?: { playerId?: string } }
      if (frame.event === PLAYER_JOIN_ACK && typeof frame.data?.playerId === 'string') {
        playerIdRef.current = frame.data.playerId
        append('info', `joined as ${frame.data.playerId}`)
      }
    } catch {
      // not JSON — ignore
    }
  }

  function open(target: string, onOpen?: () => void): void {
    socketRef.current?.close()
    append('info', `connecting to ${target}…`)
    setStatus('connecting')

    const socket = new WebSocket(target)
    socketRef.current = socket
    socket.onopen = (): void => {
      setStatus('open')
      append('info', 'connection open')
      onOpen?.()
    }
    socket.onmessage = (event): void => {
      const raw = String(event.data)
      append('in', raw + rttNote(raw))
      capturePlayerId(raw)
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

  function joinPayload(): string {
    const data: { roomCode: string; playerName: string; playerId?: string } = {
      roomCode: code,
      playerName: name,
    }
    if (playerIdRef.current) {
      data.playerId = playerIdRef.current
    }
    return JSON.stringify(data)
  }

  function connectAndJoin(): void {
    if (!code || !name) {
      append('info', 'enter a room code and a name first')
      return
    }
    open(url, () => send(PLAYER_JOIN, joinPayload()))
  }

  function leave(): void {
    send(PLAYER_LEAVE, '')
  }

  return (
    <main className="console">
      <h1>Client WebSocket debug console</h1>

      <section className="row">
        <input
          aria-label="server url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={status !== 'closed'}
        />
        {status === 'closed' ? (
          <button onClick={() => open(url)}>Connect</button>
        ) : (
          <button onClick={disconnect}>Disconnect</button>
        )}
        <span className="status" data-status={status}>
          {status}
        </span>
      </section>

      <section className="row">
        <input aria-label="room code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="room code" />
        <input aria-label="player name" value={name} onChange={(e) => setName(e.target.value)} placeholder="your name" />
        <button onClick={connectAndJoin}>Connect &amp; join</button>
        <button onClick={leave}>Leave</button>
        <button onClick={connectAndJoin} disabled={!playerIdRef.current}>
          Reconnect
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
