import { Body, Controller, Param, Post } from '@nestjs/common'
import { LobbyService } from './lobby.service'
import { BasicResponseDto, KickPlayerDto } from '@brain-wiz/shared/dto/rest-api.dto'
import { ApiOperation, ApiResponse } from '@nestjs/swagger'

@Controller('lobbies')
export class LobbyController {
  public constructor(private readonly lobby: LobbyService) {}

  @Post(':roomCode/kick')
  @ApiOperation({ summary: 'Kick a player from a room' })
  @ApiResponse({
    status: 200,
    description: 'Player successfully kicked or request was rejected',
    type: BasicResponseDto,
  })
  public async kickPlayer(
    @Param('roomCode') roomCode: string,
    @Body() body: KickPlayerDto
  ): Promise<BasicResponseDto> {
    return this.lobby.kickPlayerByRoom({
      roomCode,
      playerId: body.playerId,
      hostToken: body.hostToken,
    })
  }
}
