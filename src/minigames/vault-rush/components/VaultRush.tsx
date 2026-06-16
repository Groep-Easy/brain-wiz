import { useEffect, useState, type JSX } from 'react'
import type { VaultRushProps } from './VaultRush.types.js'
import './VaultRush.css'

const MAX_CODE_LENGTH = 4

export function VaultRush({
  puzzle,
  readOnly = false,
  solutionCode,
  onCodeChange,
}: VaultRushProps): JSX.Element {
  const [code, setCode] = useState('')

  useEffect(() => {
    setCode('')
    onCodeChange?.('')
  }, [puzzle.id])

  function handleCodeChange(value: string): void {
    const nextCode = value.replace(/\D/g, '').slice(0, MAX_CODE_LENGTH)

    setCode(nextCode)
    onCodeChange?.(nextCode)
  }

  return (
    <main className="vault-rush-app">
      <section className="vault-rush-card">
        <header className="vault-rush-header">
          <p className="vault-rush-kicker">Mini-game</p>
          <h1>Vault Rush</h1>
          <p className="vault-rush-subtitle">Crack the 4-digit vault code</p>
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
          <label className="vault-rush-input-label">
            Enter code
            <input
              className="vault-rush-input"
              inputMode="numeric"
              maxLength={MAX_CODE_LENGTH}
              onChange={(event) => {
                handleCodeChange(event.target.value)
              }}
              pattern="[0-9]*"
              value={code}
            />
          </label>
        ) : null}

        {solutionCode ? (
          <p className="vault-rush-solution">Correct code: {solutionCode}</p>
        ) : null}
      </section>
    </main>
  )
}
