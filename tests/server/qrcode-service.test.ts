/**
 * @file qrcode-service.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { QrcodeService } from '../../src/server/qrcode/qrcode.service'

describe('QrcodeService.generateSvg', () => {
  it('returns an SVG string for a join URL', async () => {
    const service = new QrcodeService()

    const svg = await service.generateSvg('http://localhost:3000/join?code=ABCD1234')

    assert.equal(typeof svg, 'string')
    assert.ok(svg.includes('<svg'))
    assert.ok(svg.includes('</svg>'))
    assert.ok(svg.includes('<path'))
  })

  it('uses the configured SVG size and colors', async () => {
    const service = new QrcodeService()

    const svg = await service.generateSvg('http://localhost:3000/join?code=ABCD1234')

    assert.ok(svg.includes('width="300"'))
    assert.ok(svg.includes('height="300"'))
    assert.ok(svg.includes('#000000'))
    assert.ok(svg.includes('#ffffff'))
  })
})
