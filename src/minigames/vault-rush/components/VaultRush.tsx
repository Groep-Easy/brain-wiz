import { useEffect, useState, type JSX } from 'react'
import type { VaultRushProps } from './VaultRush.types.js'
import './VaultRush.css'

//import { isMuted } from '@brain-wiz/shared/SFX/mute'
import { sounds } from '@brain-wiz/shared/SFX/SFX'

const MAX_CODE_LENGTH = 4

export function VaultRush({
  puzzle,
  readOnly = false,
  solutionCode,
  submitted = false,
  secondsRemaining,
  onCodeChange,
  onSubmitCode,
}: VaultRushProps): JSX.Element {
  const [code, setCode] = useState('')

  useEffect(() => {
    setCode('')
  }, [puzzle.id])

  const showTimer = typeof secondsRemaining === 'number' && !solutionCode
  const isTimerDanger = showTimer && secondsRemaining <= 5
  const timerText = showTimer ? String(secondsRemaining).padStart(2, '0') : '--'
  //const muted = isMuted()

  function handleCodeChange(value: string): void {
    if (submitted) {
      return
    }

    const nextCode = value.replace(/\D/g, '').slice(0, MAX_CODE_LENGTH)

    setCode(nextCode)
    onCodeChange?.(nextCode)
  }

  return (
    <>
      <audio
        id="vault-rush-music"
        loop
        autoPlay
        src={sounds.vaultRush}
        preload="auto">
      </audio>
      <main className="vault-rush-app">
        <section className="vault-rush-card">
          <header className="vault-rush-header">
            <p className="vault-rush-kicker">Mini-game</p>
            <h1>Vault Rush</h1>
            <p className="vault-rush-subtitle">Crack the 4-digit vault code</p>

            {showTimer ? (
              <div
                className={`vault-rush-timer ${isTimerDanger ? 'vault-rush-timer--danger' : ''}`}
                aria-live="polite"
              >
                <span className="vault-rush-timer-label">Time left</span>
                <span className="vault-rush-timer-display">{timerText}</span>
                <span className="vault-rush-timer-unit">sec</span>
              </div>
            ) : null}
          </header>

          <div aria-label="Vault code" className="vault-rush-code">
            {Array.from({ length: puzzle.digitCount }).map((_item, index) => {
              const digit = solutionCode?.[index] ?? code[index] ?? ''
              return (
                <span className="vault-rush-code-box" key={`vault-code-${index}`}>
                  {digit || '•'}
                </span>
              )
            })}
          </div>

          <section className="vault-rush-clues" aria-label="Vault clues">
            {puzzle.clues.map((clue) => (
              <p className="vault-rush-clue" key={`clue-${clue.digitIndex}`}>
                {clue.text}
              </p>
            ))}
          </section>

          {!readOnly ? (
            <form
              className="vault-rush-form"
              onSubmit={(event) => {
                event.preventDefault()

                if (code.length !== puzzle.digitCount || submitted) {
                  return
                }

                onSubmitCode?.(code)
              }}
            >
              <label className="vault-rush-input-label">
                Enter code
                <input
                  className="vault-rush-input"
                  disabled={submitted}
                  inputMode="numeric"
                  maxLength={MAX_CODE_LENGTH}
                  onChange={(event) => {
                    handleCodeChange(event.target.value)
                  }}
                  pattern="[0-9]*"
                  value={code}
                />
              </label>

              <button
                className="primary-btn vault-rush-submit"
                disabled={submitted || code.length !== puzzle.digitCount}
                type="submit"
              >
                Submit code
              </button>
            </form>
          ) : null}

          {solutionCode ? <p className="vault-rush-solution">Correct code: {solutionCode}</p> : null}
        </section>
      </main>
    </>
  )
}
