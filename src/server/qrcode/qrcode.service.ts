/**
 * @file qrcode.service.ts
 * @description Service for generating QR-code assets used by game rooms.
 *
 * This service:
 * - Generates QR codes for room join links
 * - Returns QR codes as SVG strings
 * - Encapsulates the underlying QR-code library implementation
 */
import { Injectable } from '@nestjs/common'
import * as QRCode from 'qrcode'

@Injectable()
export class QrcodeService {
  public async generateSvg(text: string): Promise<string> {
    return QRCode.toString(text, {
      type: 'svg',
      width: 300,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
  }
}
