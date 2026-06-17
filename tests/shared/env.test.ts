/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  isDevelopment,
  getBackendWsUrl,
  getBackendHttpUrl,
  getClientBaseUrl,
} from '../../src/shared/utils/env'

describe('Env Utils', () => {
  let originalWindow: unknown
  let originalProcessEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalWindow = (global as any).window
    delete (global as any).window
    originalProcessEnv = { ...process.env }
  })

  afterEach(() => {
    ;(global as any).window = originalWindow
    process.env = originalProcessEnv
  })

  describe('isDevelopment', () => {
    it('returns false when not in development', () => {
      process.env['NODE_ENV'] = 'production'
      assert.equal(isDevelopment(), false)
    })

    it('returns true when NODE_ENV is development', () => {
      process.env['NODE_ENV'] = 'development'
      assert.equal(isDevelopment(), true)
    })
  })

  describe('getBackendWsUrl', () => {
    it('returns env url if provided', () => {
      assert.equal(getBackendWsUrl('wss://custom.url'), 'wss://custom.url')
    })

    it('returns ws://hostname:3000 if development', () => {
      process.env['NODE_ENV'] = 'development'
      ;(global as any).window = {
        location: { hostname: 'localhost', port: '5173' },
      }
      assert.equal(getBackendWsUrl(), 'ws://localhost:3000')
    })

    it('returns ws://host if not development and protocol is http:', () => {
      process.env['NODE_ENV'] = 'production'
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

    it('returns wss://host if not development and protocol is https:', () => {
      process.env['NODE_ENV'] = 'production'
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
    it('returns http://hostname:5173 if development', () => {
      process.env['NODE_ENV'] = 'development'
      ;(global as any).window = { location: { hostname: 'localhost', port: '5173' } }
      assert.equal(getClientBaseUrl(), 'http://localhost:5173')
    })

    it('returns window origin if window is defined and not development', () => {
      process.env['NODE_ENV'] = 'production'
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
