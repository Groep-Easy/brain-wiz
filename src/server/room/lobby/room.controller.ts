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
import {
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger'

interface StartRoomBody {
  hostToken?: string
}

@Controller('rooms')
export class RoomsController {
  public constructor(private readonly lobby: LobbyService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a room',
    description: 'Creates a new lobby room and returns a join code + host token',
  })
  @ApiCreatedResponse({
    description: 'Room successfully created',
    schema: {
      example: {
        code: 'ABCD12',
        hostToken: 'host_123456',
      },
    },
  })
  public async createRoom(): Promise<{ code: string; hostToken: string }> {
    const { code, hostToken } = await this.lobby.createRoom()
    return { code, hostToken }
  }

  @Get(':code')
  @ApiOperation({
    summary: 'Join room',
    description: 'Returns the full state of a room by join code',
  })
  @ApiParam({
    name: 'code',
    example: 'ABCD12',
    description: 'Room join code',
  })
  @ApiOkResponse({
    description: 'Room found',
    schema: {
      example: {
        code: 'ABCD12',
        players: [],
        status: 'LOBBY',
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Room not found',
  })
  public async getRoom(@Param('code') code: string): Promise<RoomState> {
    const state = await this.lobby.getRoomState(code)
    if (!state) {
      throw new NotFoundException('Room not found')
    }
    return state
  }

  @Post(':code/start')
  @ApiOperation({
    summary: 'Start game in room',
    description: 'Starts the game if host token is valid and room is ready',
  })
  @ApiParam({
    name: 'code',
    example: 'ABCD12',
  })
  @ApiBody({
    schema: {
      example: {
        hostToken: 'host_123456',
      },
    },
  })
  @ApiOkResponse({
    description: 'Game started successfully',
    schema: {
      example: {
        code: 'ABCD12',
        status: 'IN_GAME',
        players: [],
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Room not found',
  })
  @ApiForbiddenResponse({
    description: 'Invalid host token',
  })
  @ApiConflictResponse({
    description: 'Not enough players to start',
  })
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
