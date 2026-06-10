import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import type { Player } from '../../shared/types/index'
import {
  STORAGE_KEY,
  MIN_FLOW_BLOCKS,
  MAX_FLOW_COLUMNS,
  blockById,
  loadFlow,
  saveFlow,
  randomFlow,
  type FlowItem,
} from '../flow/blocks'
import { buildSerpentine } from '../flow/serpentine'
import '../styles/setup_lobby.css'

interface SetupLobbyProps {
  roomCode: string
  players: Player[]
  onStartGame: (timePerQuestion: number, questionCount: number) => void
  onCloseLobby: () => void
}

export function SetupLobby({
  roomCode,
  players,
  onStartGame,
  onCloseLobby,
}: SetupLobbyProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<'lobby' | 'settings'>('lobby')
  const [timePerQuestion, setTimePerQuestion] = useState(20)
  const [questionCount, setQuestionCount] = useState(10)
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('')
  // The game flow: a randomized default that the host can customize in the editor.
  const [flow, setFlow] = useState<FlowItem[]>(() => {
    const existing = loadFlow()
    if (existing.length >= MIN_FLOW_BLOCKS) return existing
    const generated = randomFlow()
    saveFlow(generated)
    return generated
  })

  const flowTrackRef = useRef<HTMLDivElement>(null)
  // Snake grid for the blocks plus the trailing add (+) node at index flow.length.
  const { cells } = useMemo(() => buildSerpentine(flow.length + 1, MAX_FLOW_COLUMNS), [flow.length])

  // Pick up edits made in the flow editor (which runs in another tab).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        const updated = loadFlow()
        if (updated.length >= MIN_FLOW_BLOCKS) setFlow(updated)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    if (roomCode) {
      const host = window.location.hostname
      const protocol = window.location.protocol
      // Build client URL pointing to port 5173
      const joinUrl = `${protocol}//${host}${window.location.port ? ':5173' : ''}/?code=${roomCode}`
      QRCode.toDataURL(joinUrl, { width: 180, margin: 2 })
        .then((url) => setQrCodeUrl(url))
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error('Failed to generate QR code:', err)
        })
    }
  }, [roomCode])

  const handleStart = () => {
    onStartGame(timePerQuestion, questionCount)
  }

  const handleKick = (playerName: string) => {
    // eslint-disable-next-line no-console
    console.log(`Kick player: ${playerName} (Backend kick API not yet implemented)`)
  }

  return (
    <div className="host-lobby-container">
      <header className="host-lobby-header">
        <button className="close-btn" onClick={onCloseLobby} title="Close lobby" aria-label="Close lobby">
          &times;
        </button>
        <h1>Host Lobby</h1>
        <p className="hint">Scan the QR code or type the code on your phone to join.</p>
      </header>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'lobby' ? 'active' : ''}`}
          onClick={() => setActiveTab('lobby')}
        >
          Lobby
        </button>
        <button
          className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </div>

      {/* LOBBY PANEL */}
      <section className={`panel ${activeTab === 'lobby' ? 'active' : ''}`}>
        <div className="lobby-grid">
          {/* Left: QR + game PIN grouped in one block */}
          <div className="join-block">
            {qrCodeUrl ? (
              <img className="qr-code-img" src={qrCodeUrl} alt="Join Game QR Code" />
            ) : (
              <div className="qr-code-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                Generating QR...
              </div>
            )}
            <div className="code">{roomCode || '------'}</div>
          </div>

          {/* Right: connected players */}
          <div className="players">
            <h2>
              Players <span id="player-count">({players.length})</span>
            </h2>
            <ul>
              {players.length === 0 ? (
                <li className="empty">Waiting for players...</li>
              ) : (
                players.map((player) => (
                  <li key={player.id}>
                    {player.name}
                    <button
                      className="kick"
                      onClick={() => handleKick(player.name)}
                      title="Remove from lobby"
                      aria-label={`Remove ${player.name}`}
                    >
                      &times;
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        {/* Game flow row */}
        <div className="game-flow">
          <h2>Game flow</h2>
          <div className="flow-track" ref={flowTrackRef}>
            {cells.map((cell) => {
              const arrow = cell.arrow !== 'none' && (
                <span className={`flow-arrow arrow-${cell.arrow}`} aria-hidden="true">
                  {cell.arrow === 'down' ? '↓' : cell.arrow === 'left' ? '←' : '→'}
                </span>
              )
              const style = { gridRow: cell.row + 1, gridColumn: cell.col }
              // The final node is the add (+) block that opens the editor.
              if (cell.logicalIndex >= flow.length) {
                return (
                  <div className="flow-cell" key="flow-add" style={style}>
                    <button
                      className="flow-block flow-add"
                      onClick={() => window.open('/flow-editor', '_blank')}
                      title="Edit game flow"
                      aria-label="Edit game flow"
                    >
                      +
                    </button>
                    {arrow}
                  </div>
                )
              }
              const item = flow[cell.logicalIndex]
              if (!item) return null
              const block = blockById(item.blockId)
              if (!block) return null
              return (
                <div className="flow-cell" key={item.uid} style={style}>
                  <div className={`flow-block ${block.kind}`}>
                    <span className="flow-block-icon">{block.icon}</span>
                    <span className="flow-block-label">{block.label}</span>
                  </div>
                  {arrow}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* SETTINGS PANEL */}
      <section className={`panel ${activeTab === 'settings' ? 'active' : ''}`}>
        <div className="field">
          <label htmlFor="time-per-question">Time per question (seconds)</label>
          <input
            type="number"
            id="time-per-question"
            value={timePerQuestion}
            onChange={(e) => setTimePerQuestion(Number(e.target.value))}
            min="5"
            max="120"
          />
        </div>
        <div className="field">
          <label htmlFor="question-count">Number of questions</label>
          <input
            type="number"
            id="question-count"
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            min="1"
            max="50"
          />
        </div>
      </section>

      <button className="start-btn primary" onClick={handleStart} disabled={players.length === 0}>
        Start Game
      </button>
    </div>
  )
}
