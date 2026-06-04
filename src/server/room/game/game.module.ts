/**
 * @file game.module.ts
 * @owner server-squad
 * @description Game engine module. Wires the round loop with the round builder,
 * the realtime broadcaster, room/client data, the Round repository, and the
 * (stubbed) round-content presenter.
 */
import { Module } from '@nestjs/common'
import { RealtimeModule } from '../../realtime/realtime.module.js'
import { RoomModule } from '../room.module.js'
import { ClientModule } from '../../client/client.module.js'
import { DatabaseModule } from '../../database/index.js'
import { GameEngineService } from './game-engine.service.js'
import { RoundBuilder } from './round-builder.js'
import { ROUND_PRESENTER, StubRoundPresenter } from './round-presenter.js'

@Module({
  imports: [RealtimeModule, RoomModule, ClientModule, DatabaseModule],
  providers: [
    GameEngineService,
    RoundBuilder,
    { provide: ROUND_PRESENTER, useClass: StubRoundPresenter },
  ],
  exports: [GameEngineService],
})
export class GameModule {}
