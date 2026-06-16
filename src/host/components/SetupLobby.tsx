import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import type { Player } from '../../shared/types/index'
import { MAX_FLOW_COLUMNS, blockById } from '../flow/palette'
import type { StoredFlowItem } from '../flow/types'
import { buildSerpentine } from '../flow/serpentine'
import brandLogo from '../assets/BrainWiz logo.png'
import { getClientBaseUrl } from '../../shared/utils/env'
import { CharacterPreview } from '../../client/components/CharacterPreview'
import '../styles/setup_lobby.css'

interface SetupLobbyProps {
  roomCode: string
  hostToken: string
  players: Player[]
  /** The server-owned game flow (from RoomState), shown read-only in the lobby. */
  gameFlow: StoredFlowItem[]
  onStartGame: (timePerQuestion: number) => void
  onCloseLobby: () => void
}

export function SetupLobby({
  roomCode,
  hostToken,
  players,
  gameFlow,
  onStartGame,
  onCloseLobby,
}: SetupLobbyProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<'lobby' | 'settings'>('lobby')
  const [timePerQuestion, setTimePerQuestion] = useState(20)
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('')

  const flowTrackRef = useRef<HTMLDivElement>(null)
  const { cells } = useMemo(
    () => buildSerpentine(gameFlow.length + 1, MAX_FLOW_COLUMNS),
    [gameFlow.length]
  )

  const openEditor = () => {
    const params = new URLSearchParams({ code: roomCode, token: hostToken })
    window.open(`/host/flow-editor?${params.toString()}`, '_blank')
  }

  useEffect(() => {
    if (roomCode) {
      const joinUrl = `${getClientBaseUrl()}/client/?code=${roomCode}`
      QRCode.toDataURL(joinUrl, { width: 180, margin: 2 })
        .then((url) => setQrCodeUrl(url))
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error('Failed to generate QR code:', err)
        })
    }
  }, [roomCode])

  const handleStart = () => {
    onStartGame(timePerQuestion)
  }

  const handleKick = (playerName: string) => {
    // eslint-disable-next-line no-console
    console.log(`Kick player: ${playerName} (Backend kick API not yet implemented)`)
  }

  return (
    <div className="host-lobby-container">
      <img className="brand-logo" src={brandLogo} alt="BrainWiz" />
      <header className="host-lobby-header">
        <button
          className="close-btn circle-btn"
          onClick={onCloseLobby}
          title="Close lobby"
          aria-label="Close lobby"
        >
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
              <div
                className="qr-code-img"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
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
                    <CharacterPreview
                      color={player.playerAvatar.bodyColor}
                      faceId={player.playerAvatar.faceId}
                      size={40}
                    />
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
              if (cell.logicalIndex >= gameFlow.length) {
                return (
                  <div className="flow-cell" key="flow-add" style={style}>
                    <button
                      className="flow-block flow-add"
                      onClick={openEditor}
                      title="Edit game flow"
                      aria-label="Edit game flow"
                    >
                      +
                    </button>
                    {arrow}
                  </div>
                )
              }
              const item = gameFlow[cell.logicalIndex]
              if (!item) return null
              const block = blockById(item.blockId)
              if (!block) return null
              return (
                <div className="flow-cell" key={cell.logicalIndex} style={style}>
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
      </section>

      <button className="start-btn primary" onClick={handleStart} disabled={players.length === 0}>
        Start Game
      </button>
    </div>
  )
}
