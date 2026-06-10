/**
 * @file blocks.ts
 * @owner host-squad
 * @description Shared game-flow building blocks and persistence helpers used by
 * both the lobby (which shows a randomized default flow) and the flow editor
 * (which lets the host customize it). The flow is stored in localStorage so the
 * two — running in separate tabs — stay in sync via the `storage` event.
 */

export type BlockKind = 'theme' | 'minigame'

export interface BlockDef {
  id: string
  label: string
  kind: BlockKind
  icon: string
}

/** A single block placed in a flow. `uid` is a per-instance id (a block type may appear twice). */
export interface FlowItem {
  uid: string
  blockId: string
  /** How many questions a quiz (theme) block contributes. Undefined = default. */
  questions?: number
}

/** Default number of questions for a quiz block, and the allowed range. */
export const DEFAULT_QUESTIONS_PER_BLOCK = 5
export const MIN_QUESTIONS_PER_BLOCK = 1
export const MAX_QUESTIONS_PER_BLOCK = 20

/** Every block a host can place in a flow: trivia themes + mini-games. */
export const PALETTE: BlockDef[] = [
  { id: 'theme-random', label: 'Random', kind: 'theme', icon: '🎲' },
  { id: 'theme-movies', label: 'Movies', kind: 'theme', icon: '🎬' },
  { id: 'theme-music', label: 'Music', kind: 'theme', icon: '🎵' },
  { id: 'theme-coding', label: 'Coding', kind: 'theme', icon: '💻' },
  { id: 'theme-sports', label: 'Sports', kind: 'theme', icon: '⚽' },
  { id: 'mini-balance-scale', label: 'Balance Scale', kind: 'minigame', icon: '⚖️' },
  { id: 'mini-sliding-puzzle', label: 'Sliding Puzzle', kind: 'minigame', icon: '🧩' },
]

export const STORAGE_KEY = 'brainwiz.gameflow'

/** A flow must always contain at least this many blocks. */
export const MIN_FLOW_BLOCKS = 2

/** A flow may contain at most this many blocks. */
export const MAX_FLOW_BLOCKS = 15

/** The most blocks shown on a single row; 15 blocks then fill exactly 3 rows. */
export const MAX_FLOW_COLUMNS = 5

/** How many blocks the lobby generates by default. */
export const DEFAULT_FLOW_SIZE = 4

export const blockById = (id: string): BlockDef | undefined => PALETTE.find((b) => b.id === id)

let uidCounter = 0
export const nextUid = (): string => `f${Date.now()}-${uidCounter++}`

/** Build a randomized flow from the available themes and mini-games. */
export function randomFlow(size: number = DEFAULT_FLOW_SIZE): FlowItem[] {
  return Array.from({ length: size }, () => {
    const block = PALETTE[Math.floor(Math.random() * PALETTE.length)]!
    return { uid: nextUid(), blockId: block.id }
  })
}

/** Read the saved flow, dropping any items whose block no longer exists. */
export function loadFlow(): FlowItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as FlowItem[]
    return parsed.filter((item) => blockById(item.blockId))
  } catch {
    return []
  }
}

export function saveFlow(flow: FlowItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(flow))
}
