/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  isViteDevServer,
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

  describe('isViteDevServer', () => {
    it('returns false when window is undefined', () => {
      assert.equal(isViteDevServer(), false)
    })

    it('returns true for port 5173', () => {
      ;(global as any).window = { location: { port: '5173' } }
      assert.equal(isViteDevServer(), true)
    })

    it('returns true for port 5174', () => {
      ;(global as any).window = { location: { port: '5174' } }
      assert.equal(isViteDevServer(), true)
    })

    it('returns false for other ports', () => {
      ;(global as any).window = { location: { port: '3000' } }
      assert.equal(isViteDevServer(), false)
    })
  })

  describe('getBackendWsUrl', () => {
    it('returns env url if provided', () => {
      assert.equal(getBackendWsUrl('wss://custom.url'), 'wss://custom.url')
    })

    it('returns ws://hostname:3000 if vite dev server', () => {
      ;(global as any).window = {
        location: { hostname: 'localhost', port: '5173' },
      }
      assert.equal(getBackendWsUrl(), 'ws://localhost:3000')
    })

    it('returns ws://host if not vite dev server and protocol is http:', () => {
      ;(global as any).window = {
        location: {
          hostname: 'brainwiz.local',
          protocol: 'http:',
          host: 'brainwiz.local:8080',
          port: '8080',
        },
      }
      assert.equal(getBackendWsUrl(), 'ws://brainwiz.local:8080')
    })

    it('returns wss://host if not vite dev server and protocol is https:', () => {
      ;(global as any).window = {
        location: {
          hostname: 'brainwiz.com',
          protocol: 'https:',
          host: 'brainwiz.com',
          port: '443',
        },
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
    it('returns http://hostname:5173 if vite dev server', () => {
      ;(global as any).window = { location: { hostname: 'localhost', port: '5173' } }
      assert.equal(getClientBaseUrl(), 'http://localhost:5173')
    })

    it('returns window origin if window is defined and not vite dev server', () => {
      ;(global as any).window = {
        location: { hostname: 'brainwiz.com', port: '443', origin: 'https://brainwiz.com' },
      }
      assert.equal(getClientBaseUrl(), 'https://brainwiz.com')
    })

    it('returns fallback http://localhost:3000 if window is undefined', () => {
      assert.equal(getClientBaseUrl(), 'http://localhost:3000')
    })
  })
})
