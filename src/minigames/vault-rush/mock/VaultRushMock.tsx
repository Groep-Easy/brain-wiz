import { useMemo, useState, type JSX } from 'react'
import { VaultRush } from '../components/VaultRush.js'
import { getSampleVaultRushRound } from './samplePuzzle.js'
import '../mock/samplePuzzle.js'

export function VaultRushMock(): JSX.Element {
  const [puzzleIndex, setPuzzleIndex] = useState(0)
  const [submittedCode, setSubmittedCode] = useState<string | null>(null)
  const [isReveal, setIsReveal] = useState(false)

  const round = useMemo(() => getSampleVaultRushRound(puzzleIndex), [puzzleIndex])
  const isSubmitted = submittedCode !== null
  const isCorrect = submittedCode === round.code

  function resetMock(): void {
    setSubmittedCode(null)
    setIsReveal(false)
    setPuzzleIndex((currentIndex) => currentIndex + 1)
  }

  return (
    <main className="vault-rush-mock">
      <div className="vault-rush-mock__phone">
        <VaultRush
          onSubmitCode={(nextCode) => {
            setSubmittedCode(nextCode)
          }}
          puzzle={round.puzzle}
          readOnly={isReveal}
          solutionCode={isReveal ? round.code : undefined}
          submitted={isSubmitted}
        />
      </div>

      <div className="vault-rush-mock__controls">
        <button onClick={resetMock} type="button">
          New mock puzzle
        </button>

        <button
          disabled={isReveal}
          onClick={() => {
            setIsReveal(true)
          }}
          type="button"
        >
          Reveal
        </button>
      </div>

      <section className="vault-rush-mock__panel">
        <p>Submitted code: {submittedCode ?? '-'}</p>
        <p>Correct code: {round.code}</p>

        {isSubmitted ? (
          <p>{isCorrect ? 'Correct code' : 'Wrong code'}</p>
        ) : null}
      </section>
    </main>
  )
}
