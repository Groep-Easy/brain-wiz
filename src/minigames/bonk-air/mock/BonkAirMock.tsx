import { useMemo, useState, type JSX } from 'react'
import { BonkAir } from '../components/BonkAir.js'
import { getSampleBonkAirPuzzle } from './samplePuzzle.js'

/**
 * Standalone dev harness for Bonk Air. Lets you cycle puzzles, switch
 * difficulty, and toggle the reveal (watch) phase / host display mode.
 */
export function BonkAirMock(): JSX.Element {
  const [index, setIndex] = useState(0)
  const [diff, setDiff] = useState(2)
  const [phase, setPhase] = useState<'playing' | 'reveal'>('playing')
  const [isReadOnly, setIsReadOnly] = useState(false)
  const [lastSubmission, setLastSubmission] = useState<string>('—')
  const puzzle = useMemo(() => getSampleBonkAirPuzzle(index, diff), [index, diff])

  return (
    <main style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#101820' }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <BonkAir
          key={`${puzzle.seed}-${puzzle.diff}-${isReadOnly}`}
          phase={phase}
          puzzle={puzzle}
          readOnly={isReadOnly}
          onSubmissionChange={(s) => {
            const routed = Object.values(s.solution).filter((p) => p.complete).length
            setLastSubmission(`${routed} routed / ${Object.keys(s.solution).length} drawn`)
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: 8, padding: 8, flexWrap: 'wrap', color: '#fff', font: '600 13px system-ui' }}>
        <button type="button" onClick={() => setIndex((i) => i + 1)}>
          New puzzle
        </button>
        <button type="button" onClick={() => setDiff((d) => (d % 3) + 1)}>
          Difficulty: {diff}
        </button>
        <button type="button" onClick={() => setPhase((p) => (p === 'playing' ? 'reveal' : 'playing'))}>
          Phase: {phase}
        </button>
        <button type="button" onClick={() => setIsReadOnly((r) => !r)}>
          {isReadOnly ? 'Host display' : 'Player'}
        </button>
        <span>Last submission: {lastSubmission}</span>
      </div>
    </main>
  )
}
