/**
 * @file display-name.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { validateDisplayName, NAME_REJECTION } from '../../src/shared/utils/display-name'
import { PLAYER } from '../../src/config/game.config'

const LENGTH_MSG = NAME_REJECTION.length

describe('validateDisplayName', () => {
  it('accepts a normal name', () => {
    assert.deepEqual(validateDisplayName('Alex'), { ok: true })
  })

  it('trims before checking length', () => {
    assert.deepEqual(validateDisplayName('  Alex  '), { ok: true })
  })

  it('rejects an empty / whitespace-only name with the length message', () => {
    const r = validateDisplayName('   ')
    assert.deepEqual(r, { ok: false, reason: LENGTH_MSG })
  })

  it('rejects an over-long name with the length message', () => {
    const r = validateDisplayName('x'.repeat(PLAYER.NAME_MAX_LENGTH + 1))
    assert.deepEqual(r, { ok: false, reason: LENGTH_MSG })
  })

  it('rejects a reserved name (case-insensitive)', () => {
    const r = validateDisplayName('Admin')
    assert.deepEqual(r, { ok: false, reason: NAME_REJECTION.reserved })
  })

  it('rejects English profanity', () => {
    const r = validateDisplayName('fuck')
    assert.deepEqual(r, { ok: false, reason: NAME_REJECTION.profane })
  })

  it('rejects Dutch profanity', () => {
    const r = validateDisplayName('kanker')
    assert.deepEqual(r, { ok: false, reason: NAME_REJECTION.profane })
  })

  it('rejects profanity embedded in a longer name', () => {
    const r = validateDisplayName('xXkutXx')
    assert.deepEqual(r, { ok: false, reason: NAME_REJECTION.profane })
  })

  it('does not flag a clean name that contains no banned substring', () => {
    assert.deepEqual(validateDisplayName('Scunthorpe'), { ok: true })
  })
})
