import { Body, Controller, Param, Post } from '@nestjs/common'
import { LobbyService } from './lobby.service'
import { KickPlayerDto } from '@shared/dto/rest-api.dto'

@Controller('lobbies')
export class LobbyController {
  constructor(private readonly lobby: LobbyService) { }

  @Post(':code/kick')
  async kickPlayer(
    @Param('code') roomCode: string,
    @Body() body: KickPlayerDto,
  ) {
    return this.lobby.kickPlayerByRoom({
      roomCode,
      playerId: body.playerId,
      hostToken: body.hostToken, // of socket/session id
    })
  }
}
