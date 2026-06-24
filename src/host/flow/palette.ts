/**
 * @file palette.ts
 * @owner host-squad
 * @description The hardcoded building-block palette and pure flow helpers. The
 * palette is the offline fallback for the server catalog (see flow-api.ts) and
 * the resolver the lobby/editor use to render a placed block's label and icon.
 */
import type { BlockDef, FlowItem } from './types'
import {
  MAX_MINIGAME_TIME_SECONDS,
  MINIGAME_TIME_STEP_SECONDS,
  MIN_MINIGAME_TIME_SECONDS,
} from '@brain-wiz/shared/constants/flow.constants'

/** Default number of questions for a quiz block, and the allowed range. */
export const DEFAULT_QUESTIONS_PER_BLOCK = 5
export const MIN_QUESTIONS_PER_BLOCK = 1
export const MAX_QUESTIONS_PER_BLOCK = 20

/** Default mini-game time limits, matching the current server defaults. */
export const DEFAULT_MINIGAME_TIME_SECONDS = 30
const DEFAULT_MINIGAME_TIME_BY_BLOCK_ID: Record<string, number> = {
  'mini-sliding-puzzle': 40,
}

export { MAX_MINIGAME_TIME_SECONDS, MINIGAME_TIME_STEP_SECONDS, MIN_MINIGAME_TIME_SECONDS }

/** Every block a host can place in a flow: trivia themes + mini-games. */
export const PALETTE: BlockDef[] = [
  { id: 'theme-history', label: 'History', kind: 'theme', icon: '🏺' },
  { id: 'theme-science', label: 'Science', kind: 'theme', icon: '🔬' },
  { id: 'theme-sport', label: 'Sport', kind: 'theme', icon: '⚽' },
  { id: 'theme-culture', label: 'Culture', kind: 'theme', icon: '🎭' },
  { id: 'theme-geography', label: 'Geography', kind: 'theme', icon: '🌍' },
  { id: 'theme-technology', label: 'Technology', kind: 'theme', icon: '💻' },
  { id: 'theme-art', label: 'Art', kind: 'theme', icon: '🎨' },
  { id: 'theme-coding', label: 'Coding', kind: 'theme', icon: '💻' },
  { id: 'theme-films', label: 'Films', kind: 'theme', icon: '🎬' },
  { id: 'theme-gaming', label: 'Gaming', kind: 'theme', icon: '🎮' },
  { id: 'theme-general', label: 'General', kind: 'theme', icon: '🧠' },
  { id: 'theme-internet', label: 'Internet', kind: 'theme', icon: '🌐' },
  { id: 'theme-music', label: 'Music', kind: 'theme', icon: '🎵' },
  { id: 'theme-other', label: 'Other', kind: 'theme', icon: '❓' },
  { id: 'mini-balance-scale', label: 'Balance Scale', kind: 'minigame', icon: '⚖️' },
  { id: 'mini-sliding-puzzle', label: 'Sliding Puzzle', kind: 'minigame', icon: '🧩' },
  { id: 'mini-vault-rush', label: 'Vault Rush', kind: 'minigame', icon: '🔐' },
  { id: 'mini-wordle', label: 'Wordle', kind: 'minigame', icon: '📝' },
  { id: 'mini-light-switch', label: 'Light Switch Puzzle', kind: 'minigame', icon: '💡' },
  { id: 'mini-bonk-air', label: 'Bonk Air', kind: 'minigame', icon: '✈️' },
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

export function defaultMinigameTimeSeconds(blockId: string): number {
  return DEFAULT_MINIGAME_TIME_BY_BLOCK_ID[blockId] ?? DEFAULT_MINIGAME_TIME_SECONDS
}

export function clampMinigameTimeSeconds(value: number | undefined, blockId: string): number {
  const fallback = defaultMinigameTimeSeconds(blockId)
  const numeric = Number.isFinite(value) ? Number(value) : fallback
  const stepped = Math.round(numeric / MINIGAME_TIME_STEP_SECONDS) * MINIGAME_TIME_STEP_SECONDS
  return Math.max(MIN_MINIGAME_TIME_SECONDS, Math.min(MAX_MINIGAME_TIME_SECONDS, stepped))
}

export function createFlowItem(block: BlockDef): FlowItem {
  return {
    uid: nextUid(),
    blockId: block.id,
    ...(block.kind === 'minigame'
      ? { timeLimitSeconds: defaultMinigameTimeSeconds(block.id) }
      : {}),
  }
}

/** Build a randomized flow from a given set of blocks (defaults to the palette). */
export function randomFlowFrom(blocks: BlockDef[], size: number = DEFAULT_FLOW_SIZE): FlowItem[] {
  const pool = blocks.length > 0 ? blocks : PALETTE
  if (pool.length === 0) {
    return []
  }
  const shuffled = [...pool]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const a = shuffled[i]
    const b = shuffled[j]
    if (a !== undefined && b !== undefined) {
      shuffled[i] = b
      shuffled[j] = a
    }
  }
  return Array.from({ length: size }, (_, i) => {
    const block = shuffled[i % shuffled.length]
    return block ? createFlowItem(block) : { uid: nextUid(), blockId: '' }
  })
}

/** Build a randomized flow from the hardcoded palette (offline fallback). */
export function randomFlow(size: number = DEFAULT_FLOW_SIZE): FlowItem[] {
  return randomFlowFrom(PALETTE, size)
}
