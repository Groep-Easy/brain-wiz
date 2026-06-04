/**
 * @file room.controller.ts
 * @owner server-squad
 * @description HTTP routes for room lifecycle. A THIN adapter over LobbyService
 * that translates domain errors into HTTP status codes.
 */
import {
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common'
import { LobbyService } from './lobby.service'
import { RoomNotFoundError, RoomNotInLobbyError } from '../room.errors'
import { InvalidHostTokenError, NotEnoughPlayersError } from './lobby.errors'
import type { RoomState } from '../../../shared/types/index'

interface StartRoomBody {
  hostToken?: string
}

@Controller('rooms')
export class RoomsController {
  public constructor(private readonly lobby: LobbyService) {}

  /** Create a lobby room. Returns the join code and the host's control token. */
  @Post()
  public async createRoom(): Promise<{ code: string; hostToken: string }> {
    const { code, hostToken } = await this.lobby.createRoom()
    return { code, hostToken }
  }

  @Get(':code')
  public async getRoom(@Param('code') code: string): Promise<RoomState> {
    const state = await this.lobby.getRoomState(code)
    if (!state) {
      throw new NotFoundException('Room not found')
    }
    return state
  }

  @Post(':code/start')
  public async start(@Param('code') code: string, @Body() body: StartRoomBody): Promise<RoomState> {
    try {
      return await this.lobby.startGame(code, body?.hostToken ?? '')
    } catch (error) {
      if (error instanceof RoomNotFoundError) {
        throw new NotFoundException(error.message)
      }
      if (error instanceof InvalidHostTokenError) {
        throw new ForbiddenException(error.message)
      }
      if (error instanceof NotEnoughPlayersError || error instanceof RoomNotInLobbyError) {
        throw new ConflictException(error.message)
      }
      throw error
    }
  }
}
