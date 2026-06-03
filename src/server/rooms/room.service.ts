/**
 * @file room-service.ts
 * @owner server-squad
 * @description Persistence-facing operations for the `Room` entity: create a
 * lobby room with a unique join code, look one up, and transition it to active.
 * Cross-entity business rules (player counts) live in LobbyService.
 */
import 'reflect-metadata'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, type Repository } from 'typeorm'
import { Room } from '../entities/room.entity.js'
import { GameModeEnum, RoomStatusEnum } from '../entities/enums.js'
import { generateRoomCode } from '../../shared/utils/room-code.js'
import { ROUNDS, TIMER } from '../../shared/constants/game-config.js'
import { RoomNotInLobbyError } from './room.errors.js'
import { QrcodeService } from '../qrcode/qrcode.service.js'
import { config } from '../../../config/server.js'

/** Bounded retry so a pathological run of collisions cannot loop forever. */
const MAX_CODE_ATTEMPTS = 10

@Injectable()
export class RoomService {
  public constructor(
    @InjectRepository(Room)
    private readonly rooms: Repository<Room>,
    private readonly qrcodeService: QrcodeService
  ) {}

  public async createRoom(): Promise<Room> {
    const joinCode = await this.generateUniqueJoinCode()
    const qrCodePayload = `${config.BASE_URL}/join?code=${joinCode}`
    const qrCodeSvg = await this.qrcodeService.generateSvg(qrCodePayload)

    const room = this.rooms.create({
      joinCode,
      qrCodePayload,
      qrCodeSvg,
      status: RoomStatusEnum.LOBBY,
      selectedGameModes: [GameModeEnum.QUESTIONS],
      selectedThemes: [],
      selectedLanguages: [],
      totalRounds: ROUNDS.DEFAULT_SEQUENCE.length,
      defaultTimeLimitSeconds: TIMER.QUESTION_SECONDS,
      currentRoundIndex: 0,
    })

    return this.rooms.save(room)
  }

  /** The live lobby or active room for a join code, or null. */
  public async findByJoinCode(code: string): Promise<Room | null> {
    return this.rooms.findOne({
      where: { joinCode: code, status: In([RoomStatusEnum.LOBBY, RoomStatusEnum.ACTIVE]) },
    })
  }

  public async findById(id: string): Promise<Room | null> {
    return this.rooms.findOne({ where: { id } })
  }

  public async updateHostSocket(room: Room, socketId: string | null): Promise<Room> {
    room.hostSocketId = socketId
    return this.rooms.save(room)
  }

  public async startRoom(room: Room): Promise<Room> {
    if (room.status !== RoomStatusEnum.LOBBY) {
      throw new RoomNotInLobbyError()
    }

    room.status = RoomStatusEnum.ACTIVE
    room.startedAt = new Date()
    return this.rooms.save(room)
  }

  private async generateUniqueJoinCode(): Promise<string> {
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const code = generateRoomCode()
      const existing = await this.rooms.findOne({
        where: { joinCode: code, status: In([RoomStatusEnum.LOBBY, RoomStatusEnum.ACTIVE]) },
      })

      if (!existing) {
        return code
      }
    }

    throw new Error('Unable to generate a unique room code')
  }
}
