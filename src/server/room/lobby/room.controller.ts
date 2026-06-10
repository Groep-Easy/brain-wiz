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
  Put,
} from '@nestjs/common'
import { LobbyService } from './lobby.service'
import { RoomNotFoundError, RoomNotInLobbyError } from '../room.errors'
import { InvalidHostTokenError, NotEnoughPlayersError } from './lobby.errors'
import type { RoomState } from '../../../shared/types/index'
import type { GameFlowItem } from '../../../shared/types/flow'
import type { StartRoomBody, StoreFlowBody, RandomizeFlowBody } from '../room.types'

@Controller('rooms')
export class RoomsController {
  public constructor(private readonly lobby: LobbyService) {}

  /** Create a lobby room. Returns the join code and the host's control token. */
  @Post()
  public async createRoom(): Promise<{ code: string; hostToken: string }> {
    const { code, hostToken } = await this.lobby.createRoom()
    return { code, hostToken }
  }

  /** Get the current state of a room. Used by the lobby and the host's flow editor. */
  @Get(':code')
  public async getRoom(@Param('code') code: string): Promise<RoomState> {
    const state = await this.lobby.getRoomState(code)
    if (!state) {
      throw new NotFoundException('Room not found')
    }
    return state
  }

  /** Store the host-built flow on the room. Returns the normalized flow. */
  @Put(':code/flow')
  public async storeFlow(
    @Param('code') code: string,
    @Body() body: StoreFlowBody
  ): Promise<{ flow: GameFlowItem[] }> {
    try {
      const flow = await this.lobby.setRoomFlow(code, body?.hostToken ?? '', body?.flow ?? [])
      return { flow }
    } catch (error) {
      throw this.toHttp(error)
    }
  }

  /** Server-side randomize + store. Returns the generated flow. */
  @Post(':code/flow/randomize')
  public async randomizeFlow(
    @Param('code') code: string,
    @Body() body: RandomizeFlowBody
  ): Promise<{ flow: GameFlowItem[] }> {
    try {
      const flow = await this.lobby.randomizeRoomFlow(code, body?.hostToken ?? '', body?.size)
      return { flow }
    } catch (error) {
      throw this.toHttp(error)
    }
  }

  /** Translate flow domain errors into HTTP responses. */
  private toHttp(error: unknown): Error {
    if (error instanceof RoomNotFoundError) {
      return new NotFoundException(error.message)
    }
    if (error instanceof InvalidHostTokenError) {
      return new ForbiddenException(error.message)
    }
    return error as Error
  }

  /** Start the game. Returns the initial room state for convenience. */
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
