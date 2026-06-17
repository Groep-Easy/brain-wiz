import { Body, Controller, Param, Post } from '@nestjs/common'
import { LobbyService } from './lobby.service'
import { KickPlayerDto } from '@brain-wiz/shared/dto/rest-api.dto'

@Controller('lobbies')
export class LobbyController {
  public constructor(private readonly lobby: LobbyService) {}

  @Post(':code/kick')
  public async kickPlayer(
    @Param('code') roomCode: string,
    @Body() body: KickPlayerDto
  ): Promise<{ success: boolean; reason: string | undefined }> {
    return this.lobby.kickPlayerByRoom({
      roomCode,
      playerId: body.playerId,
      hostToken: body.hostToken, // of socket/session id
    })
  }
}
