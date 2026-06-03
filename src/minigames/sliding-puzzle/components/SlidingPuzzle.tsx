import { useEffect, useRef, useState, type CSSProperties, type JSX } from 'react'
import {
  DEFAULT_SCRAMBLE_MOVES,
  FALLBACK_BOARD_SIZE,
  SOLVE_STEP_MS,
  createScrambledBoard,
  getTileBackgroundPosition,
  isAdjacent,
  isSolved,
  moveTile,
  solveBoard,
  type SlidingPuzzleBoard,
  type SlidingPuzzlePuzzle,
} from '../shared/slidingPuzzleGame.js'
import './SlidingPuzzle.css'

export interface SlidingPuzzleProps {
  puzzle: SlidingPuzzlePuzzle
  showLocalControls?: boolean
}

type PuzzleStatus = 'Scrambled' | 'Playing' | 'Solved' | 'Solving' | 'No solution'

function getTileImageStyle(imageUrl: string, value: number): CSSProperties {
  return {
    backgroundImage: `url("${imageUrl}")`,
    backgroundPosition: getTileBackgroundPosition(value),
  }
}

export function SlidingPuzzle({
  puzzle,
  showLocalControls = false,
}: SlidingPuzzleProps): JSX.Element {
  const boardWrapRef = useRef<HTMLDivElement | null>(null)
  const solveTimerRef = useRef<number | undefined>(undefined)
  const [board, setBoard] = useState<SlidingPuzzleBoard>(() => puzzle.initialBoard)
  const [boardSize, setBoardSize] = useState(FALLBACK_BOARD_SIZE)
  const [moveCount, setMoveCount] = useState(0)
  const [status, setStatus] = useState<PuzzleStatus>('Scrambled')
  const [isSolving, setIsSolving] = useState(false)

  function clearSolveTimer(): void {
    if (solveTimerRef.current !== undefined) {
      window.clearInterval(solveTimerRef.current)
      solveTimerRef.current = undefined
    }
  }

  function resetBoard(nextBoard: SlidingPuzzleBoard): void {
    clearSolveTimer()
    setBoard(nextBoard)
    setMoveCount(0)
    setStatus('Scrambled')
    setIsSolving(false)
  }

  function handleTileClick(tileIndex: number): void {
    if (isSolving || !isAdjacent(tileIndex, board.indexOf(0))) {
      return
    }

    const nextBoard = moveTile(board, tileIndex)

    setBoard(nextBoard)
    setMoveCount((currentMoveCount) => currentMoveCount + 1)
    setStatus(isSolved(nextBoard) ? 'Solved' : 'Playing')
  }

  function handleScramble(): void {
    resetBoard(createScrambledBoard(DEFAULT_SCRAMBLE_MOVES))
  }

  function handleSolve(): void {
    if (isSolving) {
      return
    }

    const solutionPath = solveBoard(board)

    if (!solutionPath) {
      setStatus('No solution')
      return
    }

    if (solutionPath.length === 0) {
      setStatus('Solved')
      return
    }

    let stepIndex = 0

    clearSolveTimer()
    setStatus('Solving')
    setIsSolving(true)
    solveTimerRef.current = window.setInterval(() => {
      const nextBoard = solutionPath[stepIndex]
      if (!nextBoard) {
        clearSolveTimer()
        setStatus('Solved')
        setIsSolving(false)
        return
      }

      setBoard(nextBoard)
      setMoveCount((currentMoveCount) => currentMoveCount + 1)
      stepIndex += 1
    }, SOLVE_STEP_MS)
  }

  useEffect(() => {
    return () => {
      clearSolveTimer()
    }
  }, [])

  useEffect(() => {
    const observedBoardWrap = boardWrapRef.current

    if (!observedBoardWrap) {
      return undefined
    }

    const updateBoardSize = (): void => {
      const bounds = observedBoardWrap.getBoundingClientRect()
      const nextBoardSize = Math.floor(Math.min(bounds.width, bounds.height))

      if (nextBoardSize > 0) {
        setBoardSize(nextBoardSize)
      }
    }

    const resizeObserver = new window.ResizeObserver(updateBoardSize)
    resizeObserver.observe(observedBoardWrap)
    updateBoardSize()

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  useEffect(() => {
    resetBoard(puzzle.initialBoard)
  }, [puzzle.id, puzzle.initialBoard])

  const zeroIndex = board.indexOf(0)

  return (
    <main aria-label="Sliding puzzle game" className="sliding-puzzle-app">
      <div className="puzzle-shell">
        <header className="puzzle-topbar">
          <div>
            <p className="puzzle-kicker">Puzzle</p>
            <h1>Brain Wiz</h1>
          </div>
          <div aria-label={`${moveCount} moves`} className="move-counter">
            <strong>{moveCount.toString()}</strong>
            <span>Moves</span>
          </div>
        </header>

        <section className="puzzle-board-wrap" ref={boardWrapRef}>
          <div
            aria-label={puzzle.image.alt}
            className="puzzle-board"
            role="grid"
            style={{
              '--puzzle-board-size': `${boardSize}px`,
            } as CSSProperties}
          >
            {board.map((value, index) => {
              if (value === 0) {
                return (
                  <div
                    aria-label="Open square"
                    className="puzzle-tile--blank"
                    key="tile-0"
                    role="gridcell"
                  >
                    <span className="blank-number">0</span>
                  </div>
                )
              }

              const isMovable = isAdjacent(index, zeroIndex)

              return (
                <button
                  aria-label={`Tile ${value}`}
                  className={`puzzle-tile${isMovable ? ' is-movable' : ''}`}
                  disabled={isSolving || !isMovable}
                  key={`tile-${value}`}
                  onClick={() => {
                    handleTileClick(index)
                  }}
                  role="gridcell"
                  style={getTileImageStyle(puzzle.image.url, value)}
                  type="button"
                >
                  <span className="tile-number">{value.toString()}</span>
                </button>
              )
            })}
          </div>
        </section>

        <footer className="puzzle-controls">
          {showLocalControls ? (
            <div className="puzzle-actions">
              <button
                className="puzzle-button secondary"
                disabled={isSolving}
                onClick={handleScramble}
                type="button"
              >
                Scramble
              </button>
              <button
                className="puzzle-button"
                disabled={isSolving}
                onClick={handleSolve}
                type="button"
              >
                {isSolving ? 'Solving' : 'Solve'}
              </button>
            </div>
          ) : null}
          <p aria-live="polite" className="puzzle-status">
            {status}
          </p>
        </footer>
      </div>
    </main>
  )
}
