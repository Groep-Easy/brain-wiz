import type { SlidingPuzzleBoard } from './slidingPuzzleGame.js'

export interface SlidingPuzzleImage {
  id: string
  url: string
  alt: string
}

export interface SlidingPuzzlePuzzle {
  id: string
  image: SlidingPuzzleImage
  initialBoard: SlidingPuzzleBoard
}

export interface SlidingPuzzleGenerationInput {
  id: string
  image: SlidingPuzzleImage
  scrambleMoves?: number
}

export interface HeapNode {
  board: SlidingPuzzleBoard
  key: string
  moves: number
  previous?: HeapNode
  priority: number
}

export interface MinHeap {
  readonly length: number
  push(node: HeapNode): void
  pop(): HeapNode | undefined
}
