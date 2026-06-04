/**
 * @file realtime.module.ts
 * @owner server-squad
 * @description Shared realtime plumbing (live socket registry + wire
 * broadcaster). Extracted from LobbyModule so both the lobby and the game
 * engine can broadcast without a dependency cycle.
 */
import { Module } from '@nestjs/common'
import { ConnectionRegistry } from '../room/lobby/connection-registry'
import { RoomBroadcaster } from '../room/lobby/room-broadcaster'

@Module({
  providers: [ConnectionRegistry, RoomBroadcaster],
  exports: [ConnectionRegistry, RoomBroadcaster],
})
export class RealtimeModule {}
