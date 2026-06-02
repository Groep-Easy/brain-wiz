/* global document, window */

const BOARD_SIZE = 3
const SOLVED_BOARD = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 0])
const SOLVED_KEY = SOLVED_BOARD.join(',')
const DEFAULT_SCRAMBLE_MOVES = 80
const SOLVE_STEP_MS = 180
const FALLBACK_BOARD_SIZE = 320

const DEFAULT_PUZZLE_IMAGE = new window.URL(
  './images/local-test-puzzle.svg',
  document.currentScript.src
).href

function getReact() {
  if (!window.React) {
    throw new Error('React must be loaded before sliding-puzzle.js')
  }

  return window.React
}

function getReactDomClient() {
  if (!window.ReactDOM) {
    throw new Error('ReactDOM must be loaded before sliding-puzzle.js')
  }

  return window.ReactDOM
}

function getBoardKey(board) {
  return board.join(',')
}

function getTileRow(index) {
  return Math.floor(index / BOARD_SIZE)
}

function getTileColumn(index) {
  return index % BOARD_SIZE
}

function isAdjacent(firstIndex, secondIndex) {
  const rowDistance = Math.abs(getTileRow(firstIndex) - getTileRow(secondIndex))
  const columnDistance = Math.abs(getTileColumn(firstIndex) - getTileColumn(secondIndex))

  return rowDistance + columnDistance === 1
}

function getLegalTileIndexes(board) {
  const zeroIndex = board.indexOf(0)

  return board
    .map((_value, index) => index)
    .filter((index) => index !== zeroIndex && isAdjacent(index, zeroIndex))
}

function moveTile(board, tileIndex) {
  const zeroIndex = board.indexOf(0)

  if (!isAdjacent(tileIndex, zeroIndex)) {
    return board
  }

  const nextBoard = board.slice()
  nextBoard[zeroIndex] = nextBoard[tileIndex]
  nextBoard[tileIndex] = 0

  return nextBoard
}

function isSolved(board) {
  return getBoardKey(board) === SOLVED_KEY
}

function createScrambledBoard(moveCount = DEFAULT_SCRAMBLE_MOVES) {
  let board = SOLVED_BOARD.slice()
  let previousZeroIndex = -1

  for (let moveIndex = 0; moveIndex < moveCount; moveIndex += 1) {
    const zeroIndex = board.indexOf(0)
    const legalMoves = getLegalTileIndexes(board)
    const forwardMoves = legalMoves.filter((tileIndex) => tileIndex !== previousZeroIndex)
    const candidates = forwardMoves.length > 0 ? forwardMoves : legalMoves
    const randomIndex = Math.floor(Math.random() * candidates.length)

    previousZeroIndex = zeroIndex
    board = moveTile(board, candidates[randomIndex])
  }

  if (isSolved(board)) {
    return createScrambledBoard(moveCount)
  }

  return board
}

function countInversions(board) {
  const values = board.filter((value) => value !== 0)
  let inversions = 0

  values.forEach((value, index) => {
    values.slice(index + 1).forEach((nextValue) => {
      if (value > nextValue) {
        inversions += 1
      }
    })
  })

  return inversions
}

function isSolvable(board) {
  return countInversions(board) % 2 === 0
}

function getManhattanDistance(board) {
  return board.reduce((distance, value, index) => {
    if (value === 0) {
      return distance
    }

    const targetIndex = value - 1
    const rowDistance = Math.abs(getTileRow(index) - getTileRow(targetIndex))
    const columnDistance = Math.abs(getTileColumn(index) - getTileColumn(targetIndex))

    return distance + rowDistance + columnDistance
  }, 0)
}

function createMinHeap() {
  const nodes = []

  function swap(firstIndex, secondIndex) {
    const firstNode = nodes[firstIndex]
    nodes[firstIndex] = nodes[secondIndex]
    nodes[secondIndex] = firstNode
  }

  function bubbleUp(index) {
    let currentIndex = index

    while (currentIndex > 0) {
      const parentIndex = Math.floor((currentIndex - 1) / 2)

      if (nodes[parentIndex].priority <= nodes[currentIndex].priority) {
        break
      }

      swap(parentIndex, currentIndex)
      currentIndex = parentIndex
    }
  }

  function bubbleDown(index) {
    let currentIndex = index

    while (true) {
      const leftIndex = currentIndex * 2 + 1
      const rightIndex = leftIndex + 1
      let smallestIndex = currentIndex

      if (leftIndex < nodes.length && nodes[leftIndex].priority < nodes[smallestIndex].priority) {
        smallestIndex = leftIndex
      }

      if (rightIndex < nodes.length && nodes[rightIndex].priority < nodes[smallestIndex].priority) {
        smallestIndex = rightIndex
      }

      if (smallestIndex === currentIndex) {
        break
      }

      swap(currentIndex, smallestIndex)
      currentIndex = smallestIndex
    }
  }

  return {
    get length() {
      return nodes.length
    },
    push(node) {
      nodes.push(node)
      bubbleUp(nodes.length - 1)
    },
    pop() {
      if (nodes.length === 0) {
        return null
      }

      const root = nodes[0]
      const lastNode = nodes.pop()

      if (nodes.length > 0) {
        nodes[0] = lastNode
        bubbleDown(0)
      }

      return root
    },
  }
}

function buildSolutionPath(node) {
  const path = []
  let currentNode = node

  while (currentNode.previous) {
    path.push(currentNode.board)
    currentNode = currentNode.previous
  }

  return path.reverse()
}

function solveBoard(startBoard) {
  if (!isSolvable(startBoard)) {
    return null
  }

  const startKey = getBoardKey(startBoard)

  if (startKey === SOLVED_KEY) {
    return []
  }

  const openNodes = createMinHeap()
  const bestMoveCounts = new Map([[startKey, 0]])

  openNodes.push({
    board: startBoard,
    key: startKey,
    moves: 0,
    previous: null,
    priority: getManhattanDistance(startBoard),
  })

  while (openNodes.length > 0) {
    const currentNode = openNodes.pop()

    if (currentNode.key === SOLVED_KEY) {
      return buildSolutionPath(currentNode)
    }

    const bestKnownMoves = bestMoveCounts.get(currentNode.key)

    if (bestKnownMoves < currentNode.moves) {
      continue
    }

    getLegalTileIndexes(currentNode.board).forEach((tileIndex) => {
      const nextBoard = moveTile(currentNode.board, tileIndex)
      const nextKey = getBoardKey(nextBoard)
      const nextMoves = currentNode.moves + 1
      const knownMoves = bestMoveCounts.get(nextKey)

      if (knownMoves !== undefined && knownMoves <= nextMoves) {
        return
      }

      bestMoveCounts.set(nextKey, nextMoves)
      openNodes.push({
        board: nextBoard,
        key: nextKey,
        moves: nextMoves,
        previous: currentNode,
        priority: nextMoves + getManhattanDistance(nextBoard),
      })
    })
  }

  return null
}

function getTileBackgroundPosition(value) {
  const sourceIndex = value - 1
  const column = getTileColumn(sourceIndex)
  const row = getTileRow(sourceIndex)

  return `${column * 50}% ${row * 50}%`
}

function getQueryImageUrl() {
  const params = new window.URLSearchParams(window.location.search)

  return params.get('image') || params.get('puzzle')
}

function resolvePuzzleImageUrl(imageUrl) {
  return imageUrl || getQueryImageUrl() || DEFAULT_PUZZLE_IMAGE
}

function SlidingPuzzleGame({ imageUrl, scrambleMoves = DEFAULT_SCRAMBLE_MOVES } = {}) {
  const React = getReact()
  const h = React.createElement
  const resolvedImageUrl = resolvePuzzleImageUrl(imageUrl)
  const boardWrapRef = React.useRef(null)
  const solveTimerRef = React.useRef(null)
  const [board, setBoard] = React.useState(() => createScrambledBoard(scrambleMoves))
  const [boardSize, setBoardSize] = React.useState(FALLBACK_BOARD_SIZE)
  const [moveCount, setMoveCount] = React.useState(0)
  const [status, setStatus] = React.useState('Scrambled')
  const [isSolving, setIsSolving] = React.useState(false)

  function clearSolveTimer() {
    if (solveTimerRef.current) {
      window.clearInterval(solveTimerRef.current)
      solveTimerRef.current = null
    }
  }

  React.useEffect(() => {
    return () => clearSolveTimer()
  }, [])

  React.useEffect(() => {
    const boardWrap = boardWrapRef.current

    if (!boardWrap) {
      return undefined
    }

    function updateBoardSize() {
      const bounds = boardWrap.getBoundingClientRect()
      const nextBoardSize = Math.floor(Math.min(bounds.width, bounds.height))

      if (nextBoardSize > 0) {
        setBoardSize(nextBoardSize)
      }
    }

    const resizeObserver = new window.ResizeObserver(updateBoardSize)
    resizeObserver.observe(boardWrap)
    updateBoardSize()

    return () => resizeObserver.disconnect()
  }, [])

  React.useEffect(() => {
    clearSolveTimer()
    setBoard(createScrambledBoard(scrambleMoves))
    setMoveCount(0)
    setStatus('Scrambled')
    setIsSolving(false)
  }, [resolvedImageUrl, scrambleMoves])

  function handleTileClick(tileIndex) {
    if (isSolving || !isAdjacent(tileIndex, board.indexOf(0))) {
      return
    }

    const nextBoard = moveTile(board, tileIndex)

    setBoard(nextBoard)
    setMoveCount((currentMoveCount) => currentMoveCount + 1)
    setStatus(isSolved(nextBoard) ? 'Solved' : 'Playing')
  }

  function handleScramble() {
    clearSolveTimer()
    setBoard(createScrambledBoard(scrambleMoves))
    setMoveCount(0)
    setStatus('Scrambled')
    setIsSolving(false)
  }

  function handleSolve() {
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
      setBoard(solutionPath[stepIndex])
      setMoveCount((currentMoveCount) => currentMoveCount + 1)
      stepIndex += 1

      if (stepIndex >= solutionPath.length) {
        clearSolveTimer()
        setStatus('Solved')
        setIsSolving(false)
      }
    }, SOLVE_STEP_MS)
  }

  const zeroIndex = board.indexOf(0)

  return h(
    'main',
    {
      'aria-label': 'Sliding puzzle game',
      className: 'sliding-puzzle-app',
    },
    h(
      'div',
      { className: 'puzzle-shell' },
      h(
        'header',
        { className: 'puzzle-topbar' },
        h(
          'div',
          null,
          h('p', { className: 'puzzle-kicker' }, 'Puzzle'),
          h('h1', null, 'Brain Wiz')
        ),
        h(
          'div',
          { className: 'move-counter', 'aria-label': `${moveCount} moves` },
          h('strong', null, moveCount.toString()),
          h('span', null, 'Moves')
        )
      ),
      h(
        'section',
        { className: 'puzzle-board-wrap', ref: boardWrapRef },
        h(
          'div',
          {
            className: 'puzzle-board',
            role: 'grid',
            style: {
              '--puzzle-board-size': `${boardSize}px`,
            },
            'aria-label': 'Puzzle board',
          },
          board.map((value, index) => {
            if (value === 0) {
              return h(
                'div',
                {
                  key: 'tile-0',
                  className: 'puzzle-tile--blank',
                  role: 'gridcell',
                  'aria-label': 'Open square 0',
                },
                h('span', { className: 'blank-number' }, '0')
              )
            }

            const isMovable = isAdjacent(index, zeroIndex)

            return h(
              'button',
              {
                key: `tile-${value}`,
                className: `puzzle-tile${isMovable ? ' is-movable' : ''}`,
                disabled: isSolving || !isMovable,
                onClick: () => handleTileClick(index),
                role: 'gridcell',
                style: {
                  backgroundImage: `url(${JSON.stringify(resolvedImageUrl)})`,
                  backgroundPosition: getTileBackgroundPosition(value),
                },
                type: 'button',
                'aria-label': `Tile ${value}`,
              },
              h('span', { className: 'tile-number' }, value.toString())
            )
          })
        )
      ),
      h(
        'footer',
        { className: 'puzzle-controls' },
        h(
          'div',
          { className: 'puzzle-actions' },
          h(
            'button',
            {
              className: 'puzzle-button secondary',
              disabled: isSolving,
              onClick: handleScramble,
              type: 'button',
            },
            'Scramble'
          ),
          h(
            'button',
            {
              className: 'puzzle-button',
              disabled: isSolving,
              onClick: handleSolve,
              type: 'button',
            },
            isSolving ? 'Solving' : 'Solve'
          )
        ),
        h('p', { className: 'puzzle-status', 'aria-live': 'polite' }, status)
      )
    )
  )
}

function mountSlidingPuzzleGame(target, options = {}) {
  const React = getReact()
  const ReactDOM = getReactDomClient()
  const root = ReactDOM.createRoot(target)

  root.render(React.createElement(SlidingPuzzleGame, options))

  return root
}

window.BrainWizSlidingPuzzle = {
  SlidingPuzzleGame,
  createScrambledBoard,
  getLegalTileIndexes,
  isAdjacent,
  isSolved,
  moveTile,
  mountSlidingPuzzleGame,
  solveBoard,
}
