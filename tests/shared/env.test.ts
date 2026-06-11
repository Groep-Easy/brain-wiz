/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  isLocalhost,
  getBackendWsUrl,
  getBackendHttpUrl,
  getClientBaseUrl,
} from '../../src/shared/utils/env'

describe('Env Utils', () => {
  let originalWindow: unknown

  beforeEach(() => {
    originalWindow = (global as any).window
    delete (global as any).window
  })

  afterEach(() => {
    ;(global as any).window = originalWindow
  })

  describe('isLocalhost', () => {
    it('returns false when window is undefined', () => {
      assert.equal(isLocalhost(), false)
    })

    it('returns true for localhost hostname', () => {
      ;(global as any).window = { location: { hostname: 'localhost' } }
      assert.equal(isLocalhost(), true)
    })

    it('returns true for 127.0.0.1 hostname', () => {
      ;(global as any).window = { location: { hostname: '127.0.0.1' } }
      assert.equal(isLocalhost(), true)
    })

    it('returns false for production hostname', () => {
      ;(global as any).window = { location: { hostname: 'brainwiz.com' } }
      assert.equal(isLocalhost(), false)
    })
  })

  describe('getBackendWsUrl', () => {
    it('returns env url if provided', () => {
      assert.equal(getBackendWsUrl('wss://custom.url'), 'wss://custom.url')
    })

    it('returns ws://localhost:3000 if localhost', () => {
      ;(global as any).window = {
        location: { hostname: 'localhost', protocol: 'http:', host: 'localhost:5173' },
      }
      assert.equal(getBackendWsUrl(), 'ws://localhost:3000')
    })

    it('returns ws://host if not localhost and protocol is http:', () => {
      ;(global as any).window = {
        location: { hostname: 'brainwiz.local', protocol: 'http:', host: 'brainwiz.local:8080' },
      }
      assert.equal(getBackendWsUrl(), 'ws://brainwiz.local:8080')
    })

    it('returns wss://host if not localhost and protocol is https:', () => {
      ;(global as any).window = {
        location: { hostname: 'brainwiz.com', protocol: 'https:', host: 'brainwiz.com' },
      }
      assert.equal(getBackendWsUrl(), 'wss://brainwiz.com')
    })

    it('returns fallback ws://localhost:3000 if window is undefined', () => {
      assert.equal(getBackendWsUrl(), 'ws://localhost:3000')
    })
  })

  describe('getBackendHttpUrl', () => {
    it('replaces ws with http', () => {
      assert.equal(getBackendHttpUrl('ws://localhost:3000'), 'http://localhost:3000')
    })

    it('replaces wss with https', () => {
      assert.equal(getBackendHttpUrl('wss://brainwiz.com'), 'https://brainwiz.com')
    })
  })

  describe('getClientBaseUrl', () => {
    it('returns http://localhost:5173 if localhost', () => {
      ;(global as any).window = { location: { hostname: 'localhost' } }
      assert.equal(getClientBaseUrl(), 'http://localhost:5173')
    })

    it('returns window origin if window is defined and not localhost', () => {
      ;(global as any).window = {
        location: { hostname: 'brainwiz.com', origin: 'https://brainwiz.com' },
      }
      assert.equal(getClientBaseUrl(), 'https://brainwiz.com')
    })

    it('returns fallback http://localhost:3000 if window is undefined', () => {
      assert.equal(getClientBaseUrl(), 'http://localhost:3000')
    })
  })
})
