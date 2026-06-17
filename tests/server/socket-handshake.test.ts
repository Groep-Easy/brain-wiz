/**
 * @file socket-handshake.test.ts
 * @owner server-squad
 */
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  clientIp,
  parseHostTokenFromHeaders,
  selectSubprotocol,
} from '../../src/server/socket/helpers/index'
import { WS_SUBPROTOCOL } from '../../src/server/socket/socket.constants'

describe('selectSubprotocol', () => {
  it('selects the marker when the client offers it', () => {
    assert.equal(selectSubprotocol(new Set([WS_SUBPROTOCOL, 'tok'])), WS_SUBPROTOCOL)
  })
  it('returns false when the marker is absent (no echo, but not a rejection)', () => {
    assert.equal(selectSubprotocol(new Set(['something-else'])), false)
  })
})

describe('parseHostTokenFromHeaders', () => {
  it('extracts the non-marker subprotocol as the token', () => {
    assert.equal(
      parseHostTokenFromHeaders({ 'sec-websocket-protocol': `${WS_SUBPROTOCOL}, my-token` }),
      'my-token'
    )
  })
  it('handles no spaces after the comma', () => {
    assert.equal(
      parseHostTokenFromHeaders({ 'sec-websocket-protocol': `${WS_SUBPROTOCOL},my-token` }),
      'my-token'
    )
  })
  it('returns undefined when only the marker is present', () => {
    assert.equal(parseHostTokenFromHeaders({ 'sec-websocket-protocol': WS_SUBPROTOCOL }), undefined)
  })
  it('returns undefined when the header is absent', () => {
    assert.equal(parseHostTokenFromHeaders({}), undefined)
    assert.equal(parseHostTokenFromHeaders(undefined), undefined)
  })
})

describe('clientIp', () => {
  let originalTrustProxy: string | undefined

  beforeEach(() => {
    originalTrustProxy = process.env['TRUST_PROXY']
  })

  afterEach(() => {
    if (originalTrustProxy === undefined) {
      delete process.env['TRUST_PROXY']
    } else {
      process.env['TRUST_PROXY'] = originalTrustProxy
    }
  })

  it('reads the remote address off the socket if TRUST_PROXY is not true', () => {
    process.env['TRUST_PROXY'] = 'false'
    assert.equal(
      clientIp({
        headers: { 'x-forwarded-for': '9.9.9.9' },
        socket: { remoteAddress: '10.0.0.5' },
      }),
      '10.0.0.5'
    )
  })

  it('reads x-forwarded-for if TRUST_PROXY is true', () => {
    process.env['TRUST_PROXY'] = 'true'
    assert.equal(
      clientIp({
        headers: { 'x-forwarded-for': '9.9.9.9, 8.8.8.8' },
        socket: { remoteAddress: '10.0.0.5' },
      }),
      '9.9.9.9'
    )
  })

  it('returns empty string when unavailable', () => {
    assert.equal(clientIp(undefined), '')
    assert.equal(clientIp({}), '')
  })
})
