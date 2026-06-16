import { useState } from 'react'
import { validateDisplayName } from '../../shared/utils/display-name'
import { CharacterPreview } from './CharacterPreview'
import type { PlayerAvatar } from '../../shared/types/index'
import '../styles/CharacterPreview.css'

const FACE_COUNT = 4

const COLOR_PRESETS = [
  '#ff2d2d', // pure red
  '#ff5a3c', // vermilion
  '#ff7a59', // coral red

  '#ff8a00', // classic orange
  '#ff9f2f', // amber orange
  '#ffb35c', // soft orange

  '#ffd400', // pure yellow
  '#ffe066', // sun yellow
  '#fff199', // light butter yellow

  '#b6e600', // lime
  '#6dd400', // bright green
  '#2fbf71', // green

  '#00c2a8', // teal
  '#00a6a6', // cyan-teal
  '#5fd3c3', // soft aqua

  '#00b7ff', // sky cyan
  '#2f80ff', // blue
  '#1f4fff', // deep blue

  '#4b4bff', // indigo
  '#6a3dff', // violet-blue
  '#8a5cff', // soft indigo-violet

  '#a100ff', // purple
  '#d100ff', // magenta
  '#ff2ed1', // hot pink-magenta

  '#ffffff', // white
  '#f2f2f2', // light gray
  '#bdbdbd', // medium gray
  '#666666', // dark gray
  '#1a1a1a', // near black
]

interface JoinScreenProps {
  initialCode?: string
  error?: string | null
  onJoin: (name: string, code: string, character: PlayerAvatar) => void
}

function getRandomColor(): string {
  return COLOR_PRESETS[Math.floor(Math.random() * COLOR_PRESETS.length)]!
}

function getRandomFace(): number {
  return Math.floor(Math.random() * (FACE_COUNT - 1))
}

function createRandomCharacter(): PlayerAvatar {
  return {
    bodyColor: getRandomColor(),
    faceId: getRandomFace(),
  }
}

export function JoinScreen({
  initialCode = '',
  error,
  onJoin,
}: JoinScreenProps): React.JSX.Element {
  const [name, setName] = useState('')
  const [code, setCode] = useState(initialCode)

  const nameResult = validateDisplayName(name)
  const nameError = name.trim().length > 0 && !nameResult.ok ? nameResult.reason : null

  const [character, setCharacter] = useState<PlayerAvatar>(createRandomCharacter())
  const [showColorPalette, setShowColorPalette] = useState(false)

  function nextFace() {
    setCharacter((prev) => ({
      ...prev,
      faceId: (prev.faceId + 1) % FACE_COUNT,
    }))
  }

  function prevFace() {
    setCharacter((prev) => ({
      ...prev,
      faceId: (prev.faceId - 1 + FACE_COUNT) % FACE_COUNT,
    }))
  }

  const canJoin = name.trim().length > 0 && code.trim().length > 0

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()
    const trimmedCode = code.trim().toUpperCase()
    if (trimmedName && trimmedCode) {
      onJoin(trimmedName, trimmedCode, character)
    }
  }

  return (
    <div className="card">
      <h1>Brain Wiz</h1>
      <p className="subtitle">Join the game</p>
      <form onSubmit={handleSubmit}>
        <div className="face-controls">
          <button type="button" onClick={prevFace} className="arrow-btn">
            <svg width="48" height="48" viewBox="0 0 24 24">
              <polygon points="16,4 6,12 16,20" />
            </svg>
          </button>
          <CharacterPreview color={character.bodyColor} faceId={character.faceId} />
          <button type="button" onClick={nextFace} className="arrow-btn">
            <svg width="48" height="48" viewBox="0 0 24 24">
              <polygon points="8,4 18,12 8,20" />
            </svg>
          </button>
        </div>
        <div className="character-controls" style={{ position: 'relative' }}>
          {showColorPalette && (
            <div className="color-palette-popup">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  className="color-swatch"
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    setCharacter((prev) => ({
                      ...prev,
                      bodyColor: color,
                    }))
                    setShowColorPalette(false)
                  }}
                />
              ))}
            </div>
          )}
          <button
            type="button"
            className="icon-btn"
            onClick={() => setShowColorPalette((prev) => !prev)}
            title="Choose color"
          >
            <span className="color-dot" style={{ backgroundColor: character.bodyColor }} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setCharacter(createRandomCharacter())}
            title="Randomize character"
          >
            🎲
          </button>
        </div>
        <div className="field">
          <label htmlFor="player-name">Your name</label>
          <input
            id="player-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alex"
            autoComplete="off"
          />
          {nameError ? <p className="error-text">{nameError}</p> : null}
        </div>
        <div className="field">
          <label htmlFor="room-code">Room code</label>
          <input
            id="room-code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCD"
            autoComplete="off"
          />
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        <button className="primary-btn" type="submit" disabled={!canJoin}>
          Join room
        </button>
      </form>
    </div>
  )
}
