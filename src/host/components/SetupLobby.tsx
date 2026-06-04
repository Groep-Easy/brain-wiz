import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import type { Player } from '../../shared/types/index'
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
        <button className="close-btn" onClick={onCloseLobby} title="Lobby ontbinden" aria-label="Lobby ontbinden">
          &times;
        </button>
        <h1>Host Lobby</h1>
        <p className="hint">Scan de QR-code of typ de code in op je telefoon om mee te doen.</p>
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
          Instellingen
        </button>
      </div>

      {/* LOBBY PANEL */}
      <section className={`panel ${activeTab === 'lobby' ? 'active' : ''}`}>
        <div className="qr-box">
          {qrCodeUrl ? (
            <img className="qr-code-img" src={qrCodeUrl} alt="Join Game QR Code" />
          ) : (
            <div className="qr-code-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              Generating QR...
            </div>
          )}
          <div className="code">{roomCode || '------'}</div>
        </div>

        <div className="players">
          <h2>
            Spelers <span id="player-count">({players.length})</span>
          </h2>
          <ul>
            {players.length === 0 ? (
              <li className="empty">Wachten op spelers...</li>
            ) : (
              players.map((player) => (
                <li key={player.id}>
                  {player.name}
                  <button
                    className="kick"
                    onClick={() => handleKick(player.name)}
                    title="Verwijder uit lobby"
                    aria-label={`Verwijder ${player.name}`}
                  >
                    &times;
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      {/* SETTINGS PANEL */}
      <section className={`panel ${activeTab === 'settings' ? 'active' : ''}`}>
        <div className="field">
          <label htmlFor="time-per-question">Tijd per vraag (seconden)</label>
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
          <label htmlFor="question-count">Aantal vragen</label>
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
