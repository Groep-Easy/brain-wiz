import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

describe('Infrastructure Configuration Tests', () => {
  it('validates docker-compose.yml does not expose database port', () => {
    const composePath = path.resolve(__dirname, '../../docker-compose.yml')
    if (!fs.existsSync(composePath)) {
      // Skip if running from somewhere that doesn't have the compose file
      return
    }

    const composeContent = fs.readFileSync(composePath, 'utf-8')

    // We expect 5432 to NOT be published to the host machine.
    // So something like "5432:5432" should not exist.
    const hasExposedDbPort = composeContent.includes('5432:5432')

    assert.equal(
      hasExposedDbPort,
      false,
      'Security Risk: docker-compose.yml exposes PostgreSQL port 5432 to the host network interface'
    )
  })

  it('validates docker-compose.yml does not expose Loki port', () => {
    const composePath = path.resolve(__dirname, '../../docker-compose.yml')
    if (!fs.existsSync(composePath)) {
      return
    }

    const composeContent = fs.readFileSync(composePath, 'utf-8')

    // Check for Loki default port exposure
    const hasExposedLokiPort = composeContent.includes('3100:3100')

    assert.equal(
      hasExposedLokiPort,
      false,
      'Security Risk: docker-compose.yml exposes Loki port 3100 to the host network interface'
    )
  })
})
