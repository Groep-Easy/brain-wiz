import { useState } from 'react'
import { validateDisplayName } from '../../shared/utils/display-name'

interface JoinScreenProps {
  initialCode?: string
  error?: string | null
  onJoin: (name: string, code: string) => void
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
  const canJoin = nameResult.ok && code.trim().length > 0

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()
    const trimmedCode = code.trim().toUpperCase()
    if (trimmedName && trimmedCode) {
      onJoin(trimmedName, trimmedCode)
    }
  }

  return (
    <div className="card">
      <h1>Brain Wiz</h1>
      <p className="subtitle">Join the game</p>
      <form onSubmit={handleSubmit}>
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
