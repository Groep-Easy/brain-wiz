/**
 * @file rooms.module.ts
 * @description Room management feature module.
 *
 * This module:
 * - Provides room creation and retrieval functionality
 * - Exposes HTTP endpoints for room operations
 * - Integrates room persistence through TypeORM
 * - Uses the QR-code module for join-link generation
 */
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Room } from '../entities/index.js'
import { RoomsController } from './rooms.controller.js'
import { RoomsService } from './rooms.service.js'
import { QrcodeModule } from '../qrcode/qrcode.module.js'

@Module({
  imports: [TypeOrmModule.forFeature([Room]), QrcodeModule],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
