import { useMemo, useState, type JSX } from 'react'
import { SlidingPuzzle } from '../components/SlidingPuzzle.js'
import { getSampleSlidingPuzzle } from './samplePuzzle.js'
import localTestPuzzleUrl from './images/local-test-puzzle.svg?url'
import './SlidingPuzzleMock.css'

export function SlidingPuzzleMock(): JSX.Element {
  const [puzzleIndex, setPuzzleIndex] = useState(0)
  const puzzle = useMemo(
    () => getSampleSlidingPuzzle(puzzleIndex, localTestPuzzleUrl),
    [puzzleIndex]
  )

  return (
    <main className="sliding-puzzle-mock">
      <div className="sliding-puzzle-mock__phone">
        <SlidingPuzzle puzzle={puzzle} showLocalControls />
      </div>
      <div className="sliding-puzzle-mock__controls">
        <button
          onClick={() => {
            setPuzzleIndex((currentIndex) => currentIndex + 1)
          }}
          type="button"
        >
          New mock puzzle
        </button>
      </div>
    </main>
  )
}
