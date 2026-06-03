/**
 * @file qrcode-module.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { QrcodeModule } from '../../src/server/qrcode/qrcode.module'
import { QrcodeService } from '../../src/server/qrcode/qrcode.service'

describe('QrcodeModule', () => {
  it('exports the module', () => {
    assert.ok(QrcodeModule)
    assert.strictEqual(QrcodeModule.name, 'QrcodeModule')
  })

  it('exports QrcodeService', () => {
    assert.ok(QrcodeService)
    assert.strictEqual(typeof QrcodeService, 'function')
  })
})
