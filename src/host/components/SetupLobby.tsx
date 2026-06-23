import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import type { Player } from '@brain-wiz/shared/types/index'
import { MAX_FLOW_COLUMNS, blockById, defaultMinigameTimeSeconds } from '../flow/palette'
import type { StoredFlowItem } from '../flow/types'
import { buildSerpentine } from '../flow/serpentine'
import { getBackendHttpUrl, getBackendWsUrl, getClientBaseUrl } from '@brain-wiz/shared/utils/env'
import { CharacterPreview } from '@brain-wiz/shared/components/CharacterPreview'
import { WizardLogo } from '@brain-wiz/shared/components/WizardLogo'
import { MuteButton } from '@brain-wiz/shared/components/MuteButton'
import { FlowEditor } from '../screens/FlowEditor'
import { storeRoomFlow, toFlowItems } from '../flow/flow-api'
import type { FlowItem } from '../flow/types'
import '../styles/setup_lobby.css'
import { ROOM } from '@brain-wiz/config/game.config'

const BACKEND_HTTP_URL = getBackendHttpUrl(getBackendWsUrl(import.meta.env.VITE_WS_URL))

import useSound from 'use-sound'
import jazzMusic from '@brain-wiz/shared/SFX/jazz.mp3'
import startGameSound from '@brain-wiz/shared/SFX/start-game.wav'
import { isMuted } from '@brain-wiz/shared/SFX/mute'

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
  const [activeTab, setActiveTab] = useState<'lobby' | 'flow' | 'settings'>('lobby')
  const [timePerQuestion, setTimePerQuestion] = useState(20)
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('')

  const jazzRef = useRef<HTMLAudioElement>(null)
  const [playStartGameSound] = useSound(startGameSound)

  const flowTrackRef = useRef<HTMLDivElement>(null)
  const { cells } = useMemo(
    () => buildSerpentine(gameFlow.length + 1, MAX_FLOW_COLUMNS),
    [gameFlow.length]
  )

  const openEditor = () => {
    setActiveTab('flow')
  }

  const handleSaveFlow = async (newFlow: FlowItem[]) => {
    await storeRoomFlow(roomCode, hostToken, newFlow)
    setActiveTab('lobby')
  }

  const handleCancelFlow = () => {
    setActiveTab('lobby')
  }

  useEffect(() => {
    if (roomCode) {
      const joinUrl = `${getClientBaseUrl()}/client/?code=${roomCode}`
      QRCode.toDataURL(joinUrl, { width: 180, margin: 2 })
        .then((url) => setQrCodeUrl(url))
        .catch((err) => {
          console.error('Failed to generate QR code:', err)
        })
    }
  }, [roomCode])

  const ONE_SECOND_TIME_OUT = 1000
  const missingPlayers = Math.max(0, ROOM.MIN_PLAYERS_TO_START - players.length)

  const handleStart = () => {
    jazzRef.current?.pause()
    if (!isMuted()) playStartGameSound()
    setTimeout(() => {
      onStartGame(timePerQuestion)
    }, ONE_SECOND_TIME_OUT)
  }

  const handleKick = async (playerId: string) => {
    try {
      const res = await fetch(`${BACKEND_HTTP_URL}/lobbies/${roomCode}/kick`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerId,
          hostToken,
        }),
      })

      const data = await res.json()

      if (!data.success) {
        console.warn('Kick failed:', data.reason)
        return
      }
    } catch (err) {
      console.error('Kick error', err)
    }
  }

  return (
    <div className="container">
      <header className="host-lobby-header">
        <a
          href="/"
          className="header-left logo-btn"
          onClick={(e) => {
            e.preventDefault()
            onCloseLobby()
          }}
          title="Return to Home Screen"
          aria-label="Return to Home Screen"
        >
          <WizardLogo size={40} />
          <h1 className="text-logo" style={{ color: 'white' }}>
            BrainWiz
          </h1>
        </a>
        <audio ref={jazzRef} id="bg-music" loop autoPlay src={jazzMusic} preload="auto"></audio>

        <div className="header-tabs">
          <button
            className={`tab ${activeTab === 'lobby' ? 'active' : ''}`}
            onClick={() => setActiveTab('lobby')}
          >
            Lobby
          </button>
          <button
            className={`tab ${activeTab === 'flow' ? 'active' : ''}`}
            onClick={() => setActiveTab('flow')}
          >
            Game Flow
          </button>
          <button
            className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        </div>

        <div className="header-right">
          <MuteButton isInline />
          <button
            type="button"
            className="lobby-close-btn icon-btn"
            onClick={onCloseLobby}
            title="Close lobby"
            aria-label="Close lobby"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </header>

      <div className="host-lobby-card-overlay">
        <main className="host-lobby-main">
          {activeTab === 'flow' ? (
            <FlowEditor
              initialFlow={toFlowItems(gameFlow)}
              onSave={handleSaveFlow}
              onCancel={handleCancelFlow}
            />
          ) : (
            <>
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
                      <p className="hint">or visit</p>
                      <div className="join-url">brain-wiz.app</div>
                      <p className="hint">and enter code</p>
                      <div className="join-code">{roomCode}</div>
                    </div>
                  </aside>

                  {/* Right Main Content */}
                  <div className="lobby-main-cards">
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
                                onClick={async () => handleKick(player.id)}
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
                                {block.kind === 'minigame' && (
                                  <span className="flow-block-time">
                                    {item.timeLimitSeconds ??
                                      defaultMinigameTimeSeconds(item.blockId)}
                                    s
                                  </span>
                                )}
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
            </>
          )}
        </main>

        <footer className="shared-footer-bar lobby-footer">
          <p>2026 BrainWiz™. All rights reserved.</p>

          <div className="lobby-footer-right">
            {players.length < ROOM.MIN_PLAYERS_TO_START && (
              <p className="players-warning">
                Je hebt minimaal {ROOM.MIN_PLAYERS_TO_START} spelers nodig om te starten.
                Nog {missingPlayers} speler{missingPlayers === 1 ? '' : 's'} te gaan.
              </p>
            )}

            <button
              className="primary-btn start-game-btn"
              onClick={handleStart}
              disabled={players.length < ROOM.MIN_PLAYERS_TO_START}
            >
              Start Game
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
