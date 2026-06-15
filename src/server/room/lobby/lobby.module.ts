import { Module } from '@nestjs/common'
import { RoomModule } from '../room.module.js'
import { ClientModule } from '../../client/client.module.js'
import { RealtimeModule } from '../../realtime/realtime.module.js'
import { GameModule } from '../game/game.module.js'
import { LobbyService } from './lobby.service.js'
import { RoomsController } from './room.controller.js'
import { QuestionModule } from '../../question/question.module.js'
import { FlowModule } from '../../flow/flow.module.js'

@Module({
  imports: [RoomModule, ClientModule, RealtimeModule, GameModule, QuestionModule, FlowModule],
  controllers: [RoomsController],
  providers: [LobbyService],
  exports: [LobbyService],
})
export class LobbyModule {}
