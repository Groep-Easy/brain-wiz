import { describe, it } from 'node:test'
import * as assert from 'node:assert/strict'
import { Test, TestingModule } from '@nestjs/testing'
import { DatabaseModule } from '../../src/server/database/database.module'
import { getDatabaseConfig } from '../../src/config/database'

describe('DatabaseModule', () => {
  it('should compile and load configuration successfully', async () => {
    // Note: We don't actually instantiate the module fully to avoid connecting
    // to a real database during unit testing, but we verify it can be created.

    const config = getDatabaseConfig()

    assert.strictEqual(config.type, 'postgres')
    assert.ok(config.host)
    assert.ok(config.port)
    assert.ok(config.username)
    assert.ok(config.database)

    // Test NestJS module structure
    const module: TestingModule = await Test.createTestingModule({
      imports: [DatabaseModule],
    }).compile()

    assert.ok(module)
  })
})
