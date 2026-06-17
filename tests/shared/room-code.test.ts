/**
 * @file room-code.test.ts
 * @owner git-master
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { generateRoomCode, isValidRoomCode } from '../../src/shared/utils/room-code'
import { ROOM } from '../../src/config/game.config'

describe('generateRoomCode', () => {
  it('returns correct length', () => {
    assert.equal(generateRoomCode().length, ROOM.CODE_LENGTH)
  })
  it('never contains 0 O 1 I', () => {
    for (let i = 0; i < 200; i++) {
      assert.doesNotMatch(generateRoomCode(), /[0O1I]/)
    }
  })
})

describe('isValidRoomCode', () => {
  it('accepts valid generated code', () => assert.equal(isValidRoomCode(generateRoomCode()), true))
  it('rejects null', () => assert.equal(isValidRoomCode(null), false))
  it('rejects wrong length', () => assert.equal(isValidRoomCode('ABC'), false))
  it('is case-insensitive', () => assert.equal(isValidRoomCode('abcd'), true))
})
