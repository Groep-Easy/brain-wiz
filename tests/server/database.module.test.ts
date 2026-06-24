import { describe, it } from 'node:test'
import * as assert from 'node:assert/strict'
import { getDatabaseConfig } from '@brain-wiz/config/database.config'

describe('DatabaseModule', () => {
  it('validates that getDatabaseConfig returns all required fields', () => {
    // Only validate the config shape — do NOT boot a NestJS module or attempt
    // a real DB connection. Integration tests that need a live Postgres belong
    // in a separate test suite that is gated by CI environment.
    const config = getDatabaseConfig()

    assert.strictEqual(config.type, 'postgres', 'type must be postgres')
    assert.ok(config.host, 'host must be set')
    assert.ok(typeof config.port === 'number' && config.port > 0, 'port must be a positive number')
    assert.ok(config.username, 'username must be set')
    assert.ok(config.database, 'database must be set')
  })

  it('port is in a valid range (1-65535)', () => {
    const config = getDatabaseConfig()
    const port = Number(config.port)
    assert.ok(port >= 1 && port <= 65535, `port ${port} is out of range`)
  })
})
