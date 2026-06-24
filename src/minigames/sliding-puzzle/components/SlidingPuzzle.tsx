import { useCallback, useEffect, useRef, useState, type CSSProperties, type JSX } from 'react'
import {
  createScrambledBoard,
  getTileBackgroundPosition,
  isAdjacent,
  isSolved,
  moveTile,
  solveBoard,
  type SlidingPuzzleBoard,
} from '../shared/slidingPuzzleGame.js'
import {
  DEFAULT_SCRAMBLE_MOVES,
  FALLBACK_BOARD_SIZE,
  SOLVE_STEP_MS,
} from '../shared/slidingPuzzleGame.constants.js'
import {
  NO_SOLUTION_PUZZLE_STATUS,
  PLAYING_PUZZLE_STATUS,
  SCRAMBLED_PUZZLE_STATUS,
  SOLVED_PUZZLE_STATUS,
  SOLVING_PUZZLE_STATUS,
  type PuzzleStatus,
} from './SlidingPuzzle.constants.js'
import type { SlidingPuzzleProps } from './SlidingPuzzle.types.js'
import defaultPuzzleImage from './default-puzzle-image.svg?url'
import './SlidingPuzzle.css'

const DEFAULT_IMAGE_ID = 'local-test-grid'

function resolveImageUrl(image: { id?: string; url?: string }): string {
  if (image.id === DEFAULT_IMAGE_ID || !image.url) return defaultPuzzleImage
  return image.url
}

function getTileImageStyle(imageUrl: string, value: number): CSSProperties {
  return {
    backgroundImage: `url("${imageUrl}")`,
    backgroundPosition: getTileBackgroundPosition(value),
  }
}

export function SlidingPuzzle({
  puzzle,
  showLocalControls = false,
  readOnly = false,
  onBoardChange,
}: SlidingPuzzleProps): JSX.Element {
  const boardWrapRef = useRef<HTMLDivElement | null>(null)
  const solveTimerRef = useRef<number | undefined>(undefined)
  const onBoardChangeRef = useRef(onBoardChange)
  onBoardChangeRef.current = onBoardChange
  const [board, setBoard] = useState<SlidingPuzzleBoard>(() => puzzle.initialBoard)
  const [boardSize, setBoardSize] = useState(FALLBACK_BOARD_SIZE)
  const [moveCount, setMoveCount] = useState(0)
  const [status, setStatus] = useState<PuzzleStatus>(SCRAMBLED_PUZZLE_STATUS)
  const [isSolving, setIsSolving] = useState(false)

  const clearSolveTimer = useCallback((): void => {
    if (solveTimerRef.current !== undefined) {
      window.clearInterval(solveTimerRef.current)
      solveTimerRef.current = undefined
    }
  }, [])

  const resetBoard = useCallback(
    (nextBoard: SlidingPuzzleBoard): void => {
      clearSolveTimer()
      setBoard(nextBoard)
      onBoardChangeRef.current?.(nextBoard)
      setMoveCount(0)
      setStatus(SCRAMBLED_PUZZLE_STATUS)
      setIsSolving(false)
    },
    [clearSolveTimer]
  )

  function handleTileClick(tileIndex: number): void {
    if (readOnly || isSolving || !isAdjacent(tileIndex, board.indexOf(0))) {
      return
    }

    const nextBoard = moveTile(board, tileIndex)

    setBoard(nextBoard)
    onBoardChange?.(nextBoard)
    setMoveCount((currentMoveCount) => currentMoveCount + 1)
    setStatus(isSolved(nextBoard) ? SOLVED_PUZZLE_STATUS : PLAYING_PUZZLE_STATUS)
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
      setStatus(NO_SOLUTION_PUZZLE_STATUS)
      return
    }

    if (solutionPath.length === 0) {
      setStatus(SOLVED_PUZZLE_STATUS)
      return
    }

    let stepIndex = 0

    clearSolveTimer()
    setStatus(SOLVING_PUZZLE_STATUS)
    setIsSolving(true)
    solveTimerRef.current = window.setInterval(() => {
      const nextBoard = solutionPath[stepIndex]
      if (!nextBoard) {
        clearSolveTimer()
        setStatus(SOLVED_PUZZLE_STATUS)
        setIsSolving(false)
        return
      }

      setBoard(nextBoard)
      onBoardChange?.(nextBoard)
      setMoveCount((currentMoveCount) => currentMoveCount + 1)
      stepIndex += 1
    }, SOLVE_STEP_MS)
  }

  useEffect(() => {
    return () => {
      clearSolveTimer()
    }
  }, [clearSolveTimer])

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
  }, [puzzle.id, puzzle.initialBoard, resetBoard])

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
            style={
              {
                '--puzzle-board-size': `${boardSize}px`,
              } as CSSProperties
            }
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

              const isMovable = !readOnly && isAdjacent(index, zeroIndex)

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
                  style={getTileImageStyle(resolveImageUrl(puzzle.image), value)}
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
                {isSolving ? SOLVING_PUZZLE_STATUS : 'Solve'}
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
