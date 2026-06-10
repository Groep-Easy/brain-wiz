/**
 * @file palette.ts
 * @owner host-squad
 * @description The hardcoded building-block palette and pure flow helpers. The
 * palette is the offline fallback for the server catalog (see flow-api.ts) and
 * the resolver the lobby/editor use to render a placed block's label and icon.
 */
import type { BlockDef, FlowItem } from './types'

/** Default number of questions for a quiz block, and the allowed range. */
export const DEFAULT_QUESTIONS_PER_BLOCK = 5
export const MIN_QUESTIONS_PER_BLOCK = 1
export const MAX_QUESTIONS_PER_BLOCK = 20

/** Every block a host can place in a flow: trivia themes + mini-games. */
export const PALETTE: BlockDef[] = [
  { id: 'theme-history', label: 'History', kind: 'theme', icon: '🏺' },
  { id: 'theme-science', label: 'Science', kind: 'theme', icon: '🔬' },
  { id: 'theme-sport', label: 'Sport', kind: 'theme', icon: '⚽' },
  { id: 'theme-culture', label: 'Culture', kind: 'theme', icon: '🎭' },
  { id: 'theme-geography', label: 'Geography', kind: 'theme', icon: '🌍' },
  { id: 'theme-technology', label: 'Technology', kind: 'theme', icon: '💻' },
  { id: 'theme-art', label: 'Art', kind: 'theme', icon: '🎨' },
  { id: 'theme-other', label: 'Other', kind: 'theme', icon: '❓' },
  { id: 'mini-balance-scale', label: 'Balance Scale', kind: 'minigame', icon: '⚖️' },
  { id: 'mini-sliding-puzzle', label: 'Sliding Puzzle', kind: 'minigame', icon: '🧩' },
]

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

/** Build a randomized flow from a given set of blocks (defaults to the palette). */
export function randomFlowFrom(blocks: BlockDef[], size: number = DEFAULT_FLOW_SIZE): FlowItem[] {
  const pool = blocks.length > 0 ? blocks : PALETTE
  return Array.from({ length: size }, () => {
    const block = pool[Math.floor(Math.random() * pool.length)]!
    return { uid: nextUid(), blockId: block.id }
  })
}

/** Build a randomized flow from the hardcoded palette (offline fallback). */
export function randomFlow(size: number = DEFAULT_FLOW_SIZE): FlowItem[] {
  return randomFlowFrom(PALETTE, size)
}
