/**
 * @file room.module.ts
 * @description Room feature module. Owns persistence-facing operations for the
 * Room entity and exports RoomService for the lobby orchestrator.
 */
import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/index.js'
import { RoomService } from './room.service.js'

@Module({
  imports: [DatabaseModule],
  providers: [RoomService],
  exports: [RoomService],
})
export class RoomModule {}
