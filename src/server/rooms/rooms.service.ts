/**
 * @file rooms.service.ts
 * @description Service responsible for room lifecycle operations.
 *
 * This service:
 * - Creates new game rooms
 * - Generates unique join codes
 * - Generates QR-code assets for room joining
 * - Persists room data in the database
 * - Retrieves active room information
 */
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { QrcodeService } from '../qrcode/qrcode.service.js'
import { Room } from '../entities/index.js'
import { GameModeEnum, RoomStatusEnum } from '../entities/enums.js'
import { generateRoomCode } from '../../shared/utils/room-code.js'
import { config } from '../../../config/server.js'

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    private readonly qrcodeService: QrcodeService,
  ) {}

   /**
   * Generate a room code that is unique among active rooms.
   */
  private async createUniqueJoinCode(): Promise<string> {
    let code: string

    do {
      code = generateRoomCode()
    } while (
      await this.roomRepository.exists({
        where: {
          joinCode: code,
          status: In([RoomStatusEnum.LOBBY, RoomStatusEnum.ACTIVE]),
        },
      })
    )

    return code
  }

  /**
   * Create a new room with a join code and QR-code assets.
   */
  public async createRoom(): Promise<Room> {
    const joinCode = await this.createUniqueJoinCode()
    const qrCodePayload = `${config.BASE_URL}/join?code=${joinCode}`
    const qrCodeSvg = await this.qrcodeService.generateSvg(qrCodePayload)

    const room = this.roomRepository.create({
      joinCode,
      qrCodePayload,
      qrCodeSvg,
      status: RoomStatusEnum.LOBBY,
      hostSocketId: null,
      selectedGameModes: [GameModeEnum.QUESTIONS],
      selectedThemes: [],
      selectedLanguages: [],
      totalRounds: 10,
      defaultTimeLimitSeconds: 20,
      currentRoundIndex: 0,
    })

    return this.roomRepository.save(room)
  }

  /**
   * Retrieve an active room by join code.
   */
  public async getRoom(code: string): Promise<Room | null> {
    return this.roomRepository.findOne({
      where: {
        joinCode: code,
        status: In([RoomStatusEnum.LOBBY, RoomStatusEnum.ACTIVE]),
      },
    })
  }
}
