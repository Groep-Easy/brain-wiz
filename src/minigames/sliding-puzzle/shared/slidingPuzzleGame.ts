import {
  BOARD_SIZE,
  DEFAULT_SCRAMBLE_MOVES,
  FIRST_INDEX,
  HEAP_CHILD_FACTOR,
  HEAP_LEFT_CHILD_OFFSET,
  HEAP_PARENT_OFFSET,
  HEAP_RIGHT_CHILD_OFFSET,
  INVERSION_PARITY_DIVISOR,
  SOLVED_BOARD,
  TILE_BACKGROUND_STEP_PERCENT,
} from './slidingPuzzleGame.constants.js'
import type {
  HeapNode,
  MinHeap,
  SlidingPuzzleGenerationInput,
  SlidingPuzzlePuzzle,
} from './slidingPuzzleGame.types.js'

export type SlidingPuzzleBoard = number[]

export type {
  SlidingPuzzleGenerationInput,
  SlidingPuzzleImage,
  SlidingPuzzlePuzzle,
} from './slidingPuzzleGame.types.js'
export {
  BOARD_SIZE,
  DEFAULT_SCRAMBLE_MOVES,
  FALLBACK_BOARD_SIZE,
  SOLVE_STEP_MS,
  SOLVED_BOARD,
} from './slidingPuzzleGame.constants.js'

/**
 * Pure sliding-puzzle model and board math.
 * Keep sockets, DB rows, room/player ids, and image loading outside this file.
 */
export function getBoardKey(board: SlidingPuzzleBoard): string {
  return board.join(',')
}

export function getTileRow(index: number): number {
  return Math.floor(index / BOARD_SIZE)
}

export function getTileColumn(index: number): number {
  return index % BOARD_SIZE
}

export function isAdjacent(firstIndex: number, secondIndex: number): boolean {
  const rowDistance = Math.abs(getTileRow(firstIndex) - getTileRow(secondIndex))
  const columnDistance = Math.abs(getTileColumn(firstIndex) - getTileColumn(secondIndex))

  return rowDistance + columnDistance === 1
}

export function getLegalTileIndexes(board: SlidingPuzzleBoard): number[] {
  const zeroIndex = board.indexOf(0)

  return board
    .map((_value, index) => index)
    .filter((index) => index !== zeroIndex && isAdjacent(index, zeroIndex))
}

export function moveTile(board: SlidingPuzzleBoard, tileIndex: number): SlidingPuzzleBoard {
  const zeroIndex = board.indexOf(0)
  const movingTile = board[tileIndex]

  if (movingTile === undefined || !isAdjacent(tileIndex, zeroIndex)) {
    return board
  }

  const nextBoard = board.slice()
  nextBoard[zeroIndex] = movingTile
  nextBoard[tileIndex] = 0

  return nextBoard
}

export function isSolved(board: SlidingPuzzleBoard): boolean {
  return getBoardKey(board) === getBoardKey(SOLVED_BOARD)
}

export function countInversions(board: SlidingPuzzleBoard): number {
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

export function isSolvable(board: SlidingPuzzleBoard): boolean {
  return countInversions(board) % INVERSION_PARITY_DIVISOR === 0
}

export function getManhattanDistance(board: SlidingPuzzleBoard): number {
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

export function createScrambledBoard(
  moveCount = DEFAULT_SCRAMBLE_MOVES,
  random: () => number = Math.random
): SlidingPuzzleBoard {
  let board = SOLVED_BOARD.slice()
  let previousZeroIndex = -1

  for (let moveIndex = 0; moveIndex < moveCount; moveIndex += 1) {
    const zeroIndex = board.indexOf(0)
    const legalMoves = getLegalTileIndexes(board)
    const forwardMoves = legalMoves.filter((tileIndex) => tileIndex !== previousZeroIndex)
    const candidates = forwardMoves.length > 0 ? forwardMoves : legalMoves
    const randomIndex = Math.floor(random() * candidates.length)
    const nextTileIndex = candidates[randomIndex]

    if (nextTileIndex === undefined) {
      break
    }

    previousZeroIndex = zeroIndex
    board = moveTile(board, nextTileIndex)
  }

  if (isSolved(board)) {
    return createScrambledBoard(moveCount, random)
  }

  return board
}

function swap(nodes: HeapNode[], firstIndex: number, secondIndex: number): void {
  const firstNode = nodes[firstIndex]
  const secondNode = nodes[secondIndex]

  if (!firstNode || !secondNode) {
    return
  }

  nodes[firstIndex] = secondNode
  nodes[secondIndex] = firstNode
}

function bubbleUp(nodes: HeapNode[], startIndex: number): void {
  let currentIndex = startIndex

  while (currentIndex > FIRST_INDEX) {
    const parentIndex = Math.floor((currentIndex - HEAP_PARENT_OFFSET) / HEAP_CHILD_FACTOR)
    const parentNode = nodes[parentIndex]
    const currentNode = nodes[currentIndex]

    if (!parentNode || !currentNode || parentNode.priority <= currentNode.priority) {
      break
    }

    swap(nodes, parentIndex, currentIndex)
    currentIndex = parentIndex
  }
}

function bubbleDown(nodes: HeapNode[], startIndex: number): void {
  let currentIndex = startIndex

  while (true) {
    const leftIndex = currentIndex * HEAP_CHILD_FACTOR + HEAP_LEFT_CHILD_OFFSET
    const rightIndex = leftIndex + HEAP_RIGHT_CHILD_OFFSET
    let smallestIndex = currentIndex

    const leftNode = nodes[leftIndex]
    const rightNode = nodes[rightIndex]
    const smallestNode = nodes[smallestIndex]

    if (leftNode && smallestNode && leftNode.priority < smallestNode.priority) {
      smallestIndex = leftIndex
    }

    const nextSmallestNode = nodes[smallestIndex]
    if (rightNode && nextSmallestNode && rightNode.priority < nextSmallestNode.priority) {
      smallestIndex = rightIndex
    }

    if (smallestIndex === currentIndex) {
      break
    }

    swap(nodes, currentIndex, smallestIndex)
    currentIndex = smallestIndex
  }
}

function createMinHeap(): MinHeap {
  const nodes: HeapNode[] = []

  return {
    get length(): number {
      return nodes.length
    },
    push(node: HeapNode): void {
      nodes.push(node)
      bubbleUp(nodes, nodes.length - 1)
    },
    pop(): HeapNode | undefined {
      const root = nodes[FIRST_INDEX]
      const lastNode = nodes.pop()

      if (!root || !lastNode) {
        return undefined
      }

      if (nodes.length > 0) {
        nodes[FIRST_INDEX] = lastNode
        bubbleDown(nodes, FIRST_INDEX)
      }

      return root
    },
  }
}

function buildSolutionPath(node: HeapNode): SlidingPuzzleBoard[] {
  const path: SlidingPuzzleBoard[] = []
  let currentNode: HeapNode | undefined = node

  while (currentNode?.previous) {
    path.push(currentNode.board)
    currentNode = currentNode.previous
  }

  return path.reverse()
}

export function solveBoard(startBoard: SlidingPuzzleBoard): SlidingPuzzleBoard[] | undefined {
  if (!isSolvable(startBoard)) {
    return undefined
  }

  const startKey = getBoardKey(startBoard)

  if (startKey === getBoardKey(SOLVED_BOARD)) {
    return []
  }

  const openNodes = createMinHeap()
  const bestMoveCounts = new Map<string, number>([[startKey, 0]])

  openNodes.push({
    board: startBoard,
    key: startKey,
    moves: 0,
    priority: getManhattanDistance(startBoard),
  })

  while (openNodes.length > 0) {
    const currentNode = openNodes.pop()
    if (!currentNode) {
      break
    }

    if (currentNode.key === getBoardKey(SOLVED_BOARD)) {
      return buildSolutionPath(currentNode)
    }

    const bestKnownMoves = bestMoveCounts.get(currentNode.key)

    if (bestKnownMoves !== undefined && bestKnownMoves < currentNode.moves) {
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

  return undefined
}

export function getTileBackgroundPosition(value: number): string {
  const sourceIndex = value - 1
  const column = getTileColumn(sourceIndex)
  const row = getTileRow(sourceIndex)

  return `${column * TILE_BACKGROUND_STEP_PERCENT}% ${row * TILE_BACKGROUND_STEP_PERCENT}%`
}

export function createSlidingPuzzle(input: SlidingPuzzleGenerationInput): SlidingPuzzlePuzzle {
  /**
   * Server entry point later.
   * Persist by roomId/roundId with an image id/url from DB-backed content.
   */
  return {
    id: input.id,
    image: input.image,
    initialBoard: createScrambledBoard(input.scrambleMoves),
  }
}

