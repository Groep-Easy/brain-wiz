import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { buildWsUrl, wsToHttp } from '../console/console-utils'
import { ROOM_STATE_UPDATE } from '../../shared/events/socket-events'
import type { Player, RoomState } from '../../shared/types'
import '../styles/setup_lobby.css'

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3000'
const CLIENT_URL = import.meta.env.VITE_CLIENT_URL ?? 'http://localhost:5174'

type WsStatus = 'idle' | 'connecting' | 'open' | 'error'
type ActiveTab = 'lobby' | 'settings'

function noBackend(): void {
  alert('No backend support yet')
}

export function SetupLobby(): React.JSX.Element {
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [hostToken, setHostToken] = useState<string | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [wsStatus, setWsStatus] = useState<WsStatus>('idle')
  const [activeTab, setActiveTab] = useState<ActiveTab>('lobby')
  const [timePerQuestion, setTimePerQuestion] = useState(20)
  const [questionCount, setQuestionCount] = useState(10)

  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    let cancelled = false

    async function init(): Promise<void> {
      try {
        const res = await fetch(`${wsToHttp(WS_URL)}/rooms`, { method: 'POST' })
        if (!res.ok) return
        const body = (await res.json()) as { code: string; hostToken: string }
        if (cancelled) return
        setRoomCode(body.code)
        setHostToken(body.hostToken)

        setWsStatus('connecting')
        const ws = new WebSocket(
          buildWsUrl(WS_URL, { role: 'host', code: body.code, hostToken: body.hostToken })
        )
        wsRef.current = ws

        ws.onopen = (): void => {
          if (!cancelled) setWsStatus('open')
        }

        ws.onmessage = (event): void => {
          if (cancelled) return
          try {
            const frame = JSON.parse(String(event.data)) as { event: string; data?: unknown }
            if (frame.event === ROOM_STATE_UPDATE) {
              const room = (frame.data as { room: RoomState }).room
              setPlayers(room.players)
            }
          } catch {
            // malformed frame — ignore
          }
        }

        ws.onclose = (): void => {
          if (!cancelled) setWsStatus('idle')
        }

        ws.onerror = (): void => {
          if (!cancelled) setWsStatus('error')
        }
      } catch {
        if (!cancelled) setWsStatus('error')
      }
    }

    void init()

    return (): void => {
      cancelled = true
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [])

  async function handleStart(): Promise<void> {
    if (!roomCode || !hostToken) return
    await fetch(`${wsToHttp(WS_URL)}/rooms/${roomCode}/start`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hostToken }),
    })
  }

  const joinUrl = roomCode ? `${CLIENT_URL}/join?code=${roomCode}` : ''

  return (
    <>
      <header className="lobby-header">
        <button className="close-btn" title="Lobby ontbinden" onClick={noBackend}>
          &times;
        </button>
        <h1>Host Lobby</h1>
        <p className="hint">Scan de QR-code of typ de code in op je telefoon om mee te doen.</p>
      </header>

      <div className="tabs">
        <button
          className={`tab${activeTab === 'lobby' ? ' active' : ''}`}
          onClick={() => setActiveTab('lobby')}
        >
          Lobby
        </button>
        <button
          className={`tab${activeTab === 'settings' ? ' active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Instellingen
        </button>
      </div>

      <section className={`panel${activeTab === 'lobby' ? ' active' : ''}`}>
        <div className="qr-box">
          {roomCode ? (
            <QRCodeSVG value={joinUrl} size={180} bgColor="#ffffff" />
          ) : (
            <div style={{ width: 180, height: 180, background: '#eee', borderRadius: 8 }} />
          )}
          <div className="code">{roomCode ?? '------'}</div>
        </div>

        <div className="players">
          <h2>
            Spelers <span>({players.length})</span>
          </h2>
          <ul>
            {players.length === 0 ? (
              <li className="empty">Wachten op spelers...</li>
            ) : (
              players.map((p) => (
                <li key={p.id}>
                  {p.name}
                  <button className="kick" title="Verwijder uit lobby" onClick={noBackend}>
                    &times;
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      <section className={`panel${activeTab === 'settings' ? ' active' : ''}`}>
        <div className="field">
          <label htmlFor="time-per-question">Tijd per vraag (seconden)</label>
          <input
            type="number"
            id="time-per-question"
            value={timePerQuestion}
            min={5}
            max={120}
            onChange={(e) => {
              setTimePerQuestion(Number(e.target.value))
              noBackend()
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="question-count">Aantal vragen</label>
          <input
            type="number"
            id="question-count"
            value={questionCount}
            min={1}
            max={50}
            onChange={(e) => {
              setQuestionCount(Number(e.target.value))
              noBackend()
            }}
          />
        </div>
      </section>

      <button
        className="start-btn primary"
        disabled={wsStatus !== 'open' || !roomCode}
        onClick={() => void handleStart()}
      >
        {wsStatus === 'connecting' ? 'Verbinden...' : 'Start Game'}
      </button>
    </>
  )
}
