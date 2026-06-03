/**
 * @file socket-origin.test.ts
 * @owner server-squad
 * @description Unit tests for the WebSocket origin allow-list helper.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isOriginAllowed } from '../../src/server/socket/socket.origin.js'

const ALLOWED = ['http://localhost:5173', 'http://localhost:5174']

describe('isOriginAllowed', () => {
  it('allows an origin on the list', () => {
    assert.equal(isOriginAllowed('http://localhost:5173', ALLOWED), true)
  })

  it('rejects an origin not on the list', () => {
    assert.equal(isOriginAllowed('http://evil.example', ALLOWED), false)
  })

  it('allows a missing origin (non-browser client, not a CSWSH vector)', () => {
    assert.equal(isOriginAllowed(undefined, ALLOWED), true)
    assert.equal(isOriginAllowed('', ALLOWED), true)
  })

  it('rejects every present origin when the allow-list is empty', () => {
    assert.equal(isOriginAllowed('http://localhost:5173', []), false)
  })
})
