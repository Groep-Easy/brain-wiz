import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

describe('Infrastructure Configuration Tests', () => {
  it('validates docker-compose.prod.yml does not expose database port', () => {
    // Tests are run from dist/tests/infra/ (3 levels down), so go up 3 levels
    const composePath = path.resolve(__dirname, '../../../docker-compose.prod.yml')
    let finalPath = composePath
    if (!fs.existsSync(composePath)) {
      // Fallback in case it's run via ts-node from project root
      const fallbackPath = path.resolve(__dirname, '../../docker-compose.prod.yml')
      if (!fs.existsSync(fallbackPath)) {
        return
      }
      finalPath = fallbackPath
    }

    const composeContent = fs.readFileSync(finalPath, 'utf-8')

    // We expect 5432 to NOT be published to the host machine.
    // So something like "5432:5432" should not exist.
    const hasExposedDbPort = composeContent.includes('5432:5432')

    assert.equal(
      hasExposedDbPort,
      false,
      'Security Risk: docker-compose.prod.yml exposes PostgreSQL port 5432 to the host network interface'
    )
  })

  it('validates docker-compose.prod.yml does not expose Loki port', () => {
    const composePath = path.resolve(__dirname, '../../../docker-compose.prod.yml')
    let finalPath = composePath
    if (!fs.existsSync(composePath)) {
      const fallbackPath = path.resolve(__dirname, '../../docker-compose.prod.yml')
      if (!fs.existsSync(fallbackPath)) {
        return
      }
      finalPath = fallbackPath
    }

    const composeContent = fs.readFileSync(finalPath, 'utf-8')

    // Check for Loki default port exposure
    const hasExposedLokiPort = composeContent.includes('3100:3100')

    assert.equal(
      hasExposedLokiPort,
      false,
      'Security Risk: docker-compose.prod.yml exposes Loki port 3100 to the host network interface'
    )
  })
})
