/**
 * @file room.module.ts
 * @description Room feature module. Owns persistence-facing operations for the
 * Room entity and exports RoomService for the lobby orchestrator.
 */
import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/index.js'
import { RoomService } from './room.service.js'
import { QrcodeModule } from '../qrcode/qrcode.module.js'

@Module({
  imports: [DatabaseModule, QrcodeModule],
  providers: [RoomService],
  exports: [RoomService],
})
export class RoomModule {}
