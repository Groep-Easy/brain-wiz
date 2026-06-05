/**
 * @file room.module.ts
 * @description Room feature module. Owns persistence-facing operations for the
 * Room entity and exports RoomService for the lobby orchestrator.
 */
import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/index'
import { RoomService } from './room.service'
import { QrcodeModule } from '../qrcode/qrcode.module'

@Module({
  imports: [DatabaseModule, QrcodeModule],
  providers: [RoomService],
  exports: [RoomService],
})
export class RoomModule {}
