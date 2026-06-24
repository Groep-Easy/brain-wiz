/**
 * @file serpentine.test.ts
 * @owner host-squad
 */
import { describe, it } from 'node:test'
import * as assert from 'node:assert/strict'
import { buildSerpentine } from '../../src/host/flow/serpentine.js'

describe('buildSerpentine', () => {
  it('lays a short flow out as a single left-to-right row', () => {
    const { cells, count, logicalInsertForSlot } = buildSerpentine(3, 4)
    assert.equal(count, 3)
    assert.deepEqual(
      cells.map((c) => c.logicalIndex),
      [0, 1, 2]
    )
    assert.deepEqual(
      cells.map((c) => c.col),
      [1, 2, 3]
    )
    assert.deepEqual(
      cells.map((c) => c.row),
      [0, 0, 0]
    )
    assert.deepEqual(
      cells.map((c) => c.arrow),
      ['right', 'right', 'none']
    )
    assert.deepEqual(logicalInsertForSlot, [0, 1, 2, 3])
  })

  it('snakes the second row right-to-left and maps drop slots back to flow order', () => {
    const { cells, count, logicalInsertForSlot } = buildSerpentine(5, 3)
    assert.equal(count, 5)
    assert.deepEqual(
      cells.map((c) => c.logicalIndex),
      [0, 1, 2, 4, 3]
    )
    assert.deepEqual(
      cells.map((c) => c.col),
      [1, 2, 3, 2, 3]
    )
    assert.deepEqual(
      cells.map((c) => c.arrow),
      ['right', 'right', 'down', 'none', 'left']
    )
    assert.deepEqual(logicalInsertForSlot, [0, 1, 2, 3, 4, 5])
  })

  it('handles an empty flow', () => {
    const { cells, count, logicalInsertForSlot } = buildSerpentine(0, 4)
    assert.deepEqual(cells, [])
    assert.equal(count, 0)
    assert.deepEqual(logicalInsertForSlot, [0])
  })
})
