import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

function readProdCompose(): string | null {
  const candidates = [
    path.resolve(__dirname, '../../../docker-compose.yml'),
    path.resolve(__dirname, '../../docker-compose.yml'),
  ]
  const found = candidates.find((p) => fs.existsSync(p))
  return found ? fs.readFileSync(found, 'utf-8') : null
}

describe('Infrastructure Configuration Tests', () => {
  it('validates docker-compose.yml does not expose the database port', () => {
    const composeContent = readProdCompose()
    if (composeContent === null) return

    // We expect 5432 to NOT be published to the host, e.g. no "5432:5432".
    const hasExposedDbPort = composeContent.includes('5432:5432')

    assert.equal(
      hasExposedDbPort,
      false,
      'Security Risk: docker-compose.yml exposes PostgreSQL port 5432 to the host network interface'
    )
  })

  it('validates docker-compose.yml does not expose the Loki port', () => {
    const composeContent = readProdCompose()
    if (composeContent === null) return

    const hasExposedLokiPort = composeContent.includes('3100:3100')

    assert.equal(
      hasExposedLokiPort,
      false,
      'Security Risk: docker-compose.yml exposes Loki port 3100 to the host network interface'
    )
  })
})
