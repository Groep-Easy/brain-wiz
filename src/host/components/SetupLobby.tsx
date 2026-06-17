import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import type { Player } from '@shared/types/index'
import { MAX_FLOW_COLUMNS, blockById } from '../flow/palette'
import type { StoredFlowItem } from '../flow/types'
import { buildSerpentine } from '../flow/serpentine'
import { getClientBaseUrl } from '../../shared/utils/env'
import { CharacterPreview } from '../../client/components/CharacterPreview'
import { WizardLogo } from '../../shared/components/WizardLogo'
import '../styles/setup_lobby.css'
import { ENV } from '@config/env.config'

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

  const handleKick = async (playerId: string) => {
    // eslint-disable-next-line no-console
    console.log(`Kick player: ${playerId}`)
    try {
      console.log(hostToken)
    const res = await fetch(`${ENV.SERVER_BASE_URL}/lobbies/${roomCode}/kick`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        playerId,
        hostToken
      }),
    })

    const data = await res.json()

    if (!data.success) {
      console.warn('Kick failed:', data.reason)
      return
    }

    console.log('Player kicked')
  } catch (err) {
    console.error('Kick error', err)
  }

  }

  return (
    <div className="host-lobby-container">
      <header className="host-lobby-header">
        <div className="header-left">
          <WizardLogo size={32} />
          <h1 className="text-logo" style={{ color: 'white' }}>BrainWiz</h1>
        </div>

        <div className="header-tabs">
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

        <div className="header-right">
          {/* MuteButton overlays independently in the Host App, we just put Close here */}
          <button
            className="icon-btn close-btn"
            onClick={onCloseLobby}
            title="Go back"
            aria-label="Go back"
          >
            &times;
          </button>
        </div>
      </header>

      <main className="host-lobby-main">
        {/* LOBBY PANEL */}
        <section className={`panel ${activeTab === 'lobby' ? 'active' : ''}`}>
          <div className="lobby-content-grid">
            {/* Left Sidebar */}
            <aside className="lobby-sidebar">
              <div className="join-block">
                <p className="hint">Scan to Join</p>
                {qrCodeUrl ? (
                  <img className="qr-code-img" src={qrCodeUrl} alt="Join Game QR Code" />
                ) : (
                  <div className="qr-placeholder">Generating...</div>
                )}
                <div className="code-label">Room Code:</div>
                <div className="code">{roomCode || '------'}</div>
              </div>
            </aside>

            {/* Right Main Area */}
            <div className="lobby-main-area">
              <div className="players-card">
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
                          onClick={() => handleKick(player.id)}
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

              <div className="game-flow-card">
                <h2>Game Flow</h2>
                <div className="flow-track" ref={flowTrackRef}>
                  {cells.map((cell) => {
                    const arrow = cell.arrow !== 'none' && (
                      <span className={`flow-arrow arrow-${cell.arrow}`} aria-hidden="true">
                        {cell.arrow === 'down' ? '↓' : cell.arrow === 'left' ? '←' : '→'}
                      </span>
                    )
                    const style = { gridRow: cell.row + 1, gridColumn: cell.col }
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
      </main>

      <footer className="host-lobby-footer">
        <button className="primary-btn" onClick={handleStart} disabled={players.length === 0}>
          Start Game
        </button>
      </footer>
    </div>
  )
}
