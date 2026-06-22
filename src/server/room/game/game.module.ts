/**
 * @file game.module.ts
 * @owner server-squad
 * @description Game engine module. Wires the round loop, the round builder, the
 * realtime broadcaster, room/client data, repositories, the in-process event
 * bus, the real round-content presenter, and the answer/scoring services.
 */
import { Module } from '@nestjs/common'
import { RealtimeModule } from '../../realtime/realtime.module'
import { RoomModule } from '../room.module'
import { ClientModule } from '../../client/client.module'
import { DatabaseModule } from '../../database/index'
import { GameEngineService } from './game-engine.service'
import { RoundBuilder } from './round-builder'
import { ROUND_PRESENTER } from './round-presenter'
import { RoundPresenterImpl } from './round-presenter.impl'
import { GameEventBus } from './game-event-bus'
import { AnswerService } from './answer.service'
import { ScoringService } from './scoring.service'
import { MinigameRegistry } from './minigames/minigame-registry'
import { SlidingPuzzleServerAdapter } from './minigames/sliding-puzzle.server'
import { BalanceScaleServerAdapter } from './minigames/balance-scale.server'
import { VaultRushServerAdapter } from './minigames/vault-rush.server'
import { WordleServerAdapter } from './minigames/wordle.server'


@Module({
  imports: [RealtimeModule, RoomModule, ClientModule, DatabaseModule],
  providers: [
    GameEngineService,
    RoundBuilder,
    GameEventBus,
    SlidingPuzzleServerAdapter,
    BalanceScaleServerAdapter,
    VaultRushServerAdapter,
    WordleServerAdapter,
    MinigameRegistry,
    AnswerService,
    ScoringService,
    { provide: ROUND_PRESENTER, useClass: RoundPresenterImpl },
  ],
  exports: [GameEngineService, GameEventBus, AnswerService],
})
export class GameModule { }
