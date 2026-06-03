/**
 * @file rooms.controller.ts
 * @description HTTP endpoints for room lifecycle management.
 *
 * This controller:
 * - Creates new game rooms
 * - Retrieves room information by join code
 * - Validates incoming room codes
 * - Returns QR-code assets used by the host display
 */
import { BadRequestException, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common'
import { RoomsService } from './rooms.service.js'
import { isValidRoomCode } from '../../shared/utils/room-code.js'

@Controller('rooms')
export class RoomsController {
  public constructor(private readonly roomsService: RoomsService) {}

  /**
   * Create a new room and return its join information.
   */
  @Post()
  public async createRoom(): Promise<{
    code: string
    qrCodePayload: string
    qrCodeSvg: string
    status: string
  }> {

    const room = await this.roomsService.createRoom()

    return {
      code: room.joinCode,
      qrCodePayload: room.qrCodePayload,
      qrCodeSvg: room.qrCodeSvg,
      status: room.status,
    }
  }

  /**
   * Retrieve room information for a given join code.
   */
  @Get(':code')
  public async getRoom(
    @Param('code') code: string,
  ): Promise<{
    code: string
    qrCodePayload: string
    qrCodeSvg: string
    status: string
  }> {

    if (!isValidRoomCode(code)) {
      throw new BadRequestException('Invalid room code format')
    }

    const room = await this.roomsService.getRoom(code.toUpperCase())

    if (!room) {
      throw new NotFoundException('Room not found')
    }

    return {
      code: room.joinCode,
      qrCodePayload: room.qrCodePayload,
      qrCodeSvg: room.qrCodeSvg,
      status: room.status,
    }
  }
}
