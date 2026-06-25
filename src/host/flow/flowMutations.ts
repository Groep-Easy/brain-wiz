/**
 * @file flowMutations.ts
 * @description Pure transforms on a host's game-flow array: insert, move, remove,
 * and per-block settings. No DOM or React here, so they are unit-testable; the
 * FlowEditor calls them inside its `setFlow` updates.
 */
import type { BlockDef, FlowItem } from './types'
import {
  MAX_QUESTIONS_PER_BLOCK,
  MIN_FLOW_BLOCKS,
  MIN_QUESTIONS_PER_BLOCK,
  clampMinigameTimeSeconds,
  createFlowItem,
} from './palette'

/** Set a quiz block's question count, clamped to the allowed range. */
export function setBlockQuestions(flow: FlowItem[], uid: string, value: number): FlowItem[] {
  const clamped = Math.min(
    MAX_QUESTIONS_PER_BLOCK,
    Math.max(MIN_QUESTIONS_PER_BLOCK, Math.round(value) || MIN_QUESTIONS_PER_BLOCK)
  )
  return flow.map((item) => (item.uid === uid ? { ...item, questions: clamped } : item))
}

/** Set a mini-game block's time limit, clamped and stepped to the allowed range. */
export function setBlockMinigameTime(
  flow: FlowItem[],
  uid: string,
  blockId: string,
  value: number
): FlowItem[] {
  const clamped = clampMinigameTimeSeconds(value, blockId)
  return flow.map((item) => (item.uid === uid ? { ...item, timeLimitSeconds: clamped } : item))
}

/** Insert a new block (dragged from the palette) at the given flow index. */
export function insertBlock(flow: FlowItem[], index: number, block: BlockDef): FlowItem[] {
  const next = [...flow]
  next.splice(index, 0, createFlowItem(block))
  return next
}

/** Move an existing block from one index to another, accounting for the shift. */
export function moveBlock(flow: FlowItem[], from: number, index: number): FlowItem[] {
  const next = [...flow]
  const [moved] = next.splice(from, 1)
  if (!moved) return flow
  const target = from < index ? index - 1 : index
  next.splice(target, 0, moved)
  return next
}

/** Remove the block at `index`, but never drop below MIN_FLOW_BLOCKS. */
export function removeBlockAt(flow: FlowItem[], index: number): FlowItem[] {
  return flow.length <= MIN_FLOW_BLOCKS ? flow : flow.filter((_, i) => i !== index)
}
