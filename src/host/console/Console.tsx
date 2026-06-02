/**
 * @file Console.tsx
 * @owner host-squad
 * @description Throwaway WebSocket debug console, served at /console.
 *
 * NOT a real host UI — it's a manual test client for the server team, kept off
 * the host root (/) so it doesn't collide with the host team's work. It opens a
 * raw WebSocket to the server, logs every message it receives, and lets you
 * fire arbitrary `{ event, data }` frames (the NestJS `ws` envelope) so you can
 * exercise server handlers (ping/pong, PLAYER_JOIN, etc.) by hand.
 */
import { useRef, useState } from 'react'
import { PING } from '../../shared/events/socket-events'
import { parsePayload, rttNote, type Direction, type LogEntry, type Status } from './console-utils'
import './console.css'

const DEFAULT_URL = 'ws://localhost:3000'

export function Console(): React.JSX.Element {
  const [url, setUrl] = useState(DEFAULT_URL)
  const [status, setStatus] = useState<Status>('closed')
  const [log, setLog] = useState<LogEntry[]>([])
  const [eventName, setEventName] = useState<string>(PING)
  const [payload, setPayload] = useState('{}')

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

  function connect(): void {
    socketRef.current?.close()
    append('info', `connecting to ${url}…`)
    setStatus('connecting')

    const socket = new WebSocket(url)
    socketRef.current = socket
    socket.onopen = (): void => {
      setStatus('open')
      append('info', 'connection open')
    }
    socket.onmessage = (event): void => {
      const raw = String(event.data)
      append('in', raw + rttNote(raw))
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
          <button onClick={connect}>Connect</button>
        ) : (
          <button onClick={disconnect}>Disconnect</button>
        )}
        <span className="status" data-status={status}>
          {status}
        </span>
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
