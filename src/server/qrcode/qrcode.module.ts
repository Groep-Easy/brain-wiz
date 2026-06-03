/**
 * @file qrcode.module.ts
 * @description QR-code feature module.
 *
 * This module:
 * - Provides QR-code generation services
 * - Encapsulates QR-code related functionality
 * - Exports QrcodeService for use by other feature modules
 */
import { Module } from '@nestjs/common'
import { QrcodeService } from './qrcode.service.js'

@Module({
  providers: [QrcodeService],
  exports: [QrcodeService],
})
export class QrcodeModule {}
