/**
 * @file flow-mutations.test.ts
 * @owner host-squad
 */
import { describe, it } from 'node:test'
import * as assert from 'node:assert/strict'
import {
  insertBlock,
  moveBlock,
  removeBlockAt,
  setBlockMinigameTime,
  setBlockQuestions,
} from '../../src/host/flow/flowMutations.js'
import { MIN_FLOW_BLOCKS } from '../../src/host/flow/palette.js'
import type { BlockDef, FlowItem } from '../../src/host/flow/types.js'

function item(uid: string, blockId = 'theme-history'): FlowItem {
  return { uid, blockId }
}

const themeBlock: BlockDef = { id: 'theme-history', label: 'History', kind: 'theme', icon: '🏺' }

describe('setBlockQuestions', () => {
  it('clamps the question count and only touches the matching block', () => {
    const flow = [item('a'), item('b')]
    const high = setBlockQuestions(flow, 'a', 999)
    assert.equal(high[0]?.questions, 20)
    assert.equal(high[1]?.questions, undefined)
    assert.equal(setBlockQuestions(flow, 'a', 0)[0]?.questions, 1)
  })
})

describe('setBlockMinigameTime', () => {
  it('steps and clamps the time for the matching block', () => {
    const flow = [item('a', 'mini-sliding-puzzle')]
    assert.equal(
      setBlockMinigameTime(flow, 'a', 'mini-sliding-puzzle', 35)[0]?.timeLimitSeconds,
      40
    )
    assert.equal(
      setBlockMinigameTime(flow, 'a', 'mini-sliding-puzzle', 9999)[0]?.timeLimitSeconds,
      180
    )
  })
})

describe('insertBlock', () => {
  it('inserts a new block at the index, preserving the rest', () => {
    const next = insertBlock([item('a'), item('b')], 1, themeBlock)
    assert.equal(next.length, 3)
    assert.equal(next[1]?.blockId, 'theme-history')
    assert.deepEqual([next[0]?.uid, next[2]?.uid], ['a', 'b'])
  })
})

describe('moveBlock', () => {
  it('moves a block forward, accounting for the index shift', () => {
    const order = moveBlock([item('a'), item('b'), item('c')], 0, 2).map((f) => f.uid)
    assert.deepEqual(order, ['b', 'a', 'c'])
  })

  it('moves a block backward', () => {
    const order = moveBlock([item('a'), item('b'), item('c')], 2, 0).map((f) => f.uid)
    assert.deepEqual(order, ['c', 'a', 'b'])
  })

  it('returns the flow unchanged for an out-of-range source', () => {
    const flow = [item('a'), item('b')]
    assert.equal(moveBlock(flow, 9, 0), flow)
  })
})

describe('removeBlockAt', () => {
  it('removes the block at the index when above the minimum', () => {
    const order = removeBlockAt([item('a'), item('b'), item('c')], 1).map((f) => f.uid)
    assert.deepEqual(order, ['a', 'c'])
  })

  it('is a no-op at the minimum block count', () => {
    const flow = Array.from({ length: MIN_FLOW_BLOCKS }, (_, i) => item(`b${i}`))
    assert.equal(removeBlockAt(flow, 0), flow)
  })
})
