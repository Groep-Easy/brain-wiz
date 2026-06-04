/**
 * @file secure-compare.test.ts
 * @owner server-squad
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { safeEqual } from '../../src/server/socket/secure-compare.js'

describe('safeEqual', () => {
  it('returns true for identical strings', () => {
    assert.equal(safeEqual('a-secret-token', 'a-secret-token'), true)
  })
  it('returns false for different same-length strings', () => {
    assert.equal(safeEqual('abcd', 'abce'), false)
  })
  it('returns false for different-length strings', () => {
    assert.equal(safeEqual('short', 'longer-value'), false)
  })
  it('returns true for two empty strings', () => {
    assert.equal(safeEqual('', ''), true)
  })
})
