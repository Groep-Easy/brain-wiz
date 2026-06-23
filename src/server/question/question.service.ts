import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Repository } from 'typeorm'
import { Question } from '../entities/question.entity.js'
import type { CreateQuestionDto } from './dto/create-question.dto.js'
import { ConnectionRegistry } from '../room/lobby/connection-registry.js'
import { RoomBroadcaster } from '../room/lobby/room-broadcaster.js'
import * as EVENTS from '@brain-wiz/shared/constants/socket-events.constants'
import type { ClientSocket } from '../room/lobby/lobby.types.js'

const MAX_ANSWERS = 2
const MAX_USED_IDS = 1000

@Injectable()
export class QuestionService {
  public constructor(
    @InjectRepository(Question) private readonly questions: Repository<Question>,
    private readonly registry: ConnectionRegistry,
    private readonly broadcaster: RoomBroadcaster
  ) {}

  private validateUsedIds(usedIds: string[]): void {
    if (!Array.isArray(usedIds)) {
      throw new BadRequestException('usedIds must be an array')
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    for (const id of usedIds) {
      if (typeof id !== 'string' || !uuidRegex.test(id)) {
        throw new BadRequestException(`Invalid UUID in usedIds: ${id}`)
      }
    }

    const uniqueIds = new Set(usedIds)
    if (uniqueIds.size !== usedIds.length) {
      throw new BadRequestException('usedIds contains duplicates')
    }

    if (usedIds.length > MAX_USED_IDS) {
      throw new BadRequestException(`usedIds exceeds maximum size of ${MAX_USED_IDS}`)
    }
  }

  public async createQuestion(dto: CreateQuestionDto): Promise<string> {
    const wrongAnswers = dto.wrongAnswers || []

    // Additional domain constraint validation (redundant with DB entity but prevents DB crash)
    if (dto.correctAnswers.length + wrongAnswers.length !== MAX_ANSWERS) {
      throw new BadRequestException(`Question must have exactly ${MAX_ANSWERS} possible answers`)
    }

    const question = this.questions.create({
      text: dto.text,
      theme: dto.theme,
      difficulty: dto.difficulty,
      correctAnswers: dto.correctAnswers,
      wrongAnswers: wrongAnswers,
      imagePath: dto.imagePath || '',
      timeLimitSeconds: dto.timeLimitSeconds || null,
      // eslint-disable-next-line @typescript-eslint/no-magic-numbers
      basePoints: dto.basePoints ?? 1000,
    })

    try {
      const saved = await this.questions.save(question)
      return saved.id
    } catch (error) {
      // In a real production app, we would use a proper Logger instance here.

      console.error('Failed to save question:', error)
      throw new InternalServerErrorException('Failed to save question to database')
    }
  }

  // gets random unused question from the database
  public async getRandomQuestion(usedIds: string[] = []): Promise<Question | null> {
    this.validateUsedIds(usedIds)

    const queryBuilder = this.questions.createQueryBuilder('question')

    if (usedIds.length > 0) {
      queryBuilder.where('question.id NOT IN (:...usedIds)', { usedIds })
    }

    const unusedQuestions = await queryBuilder.getMany()
    if (unusedQuestions.length === 0) return null

    const randomIndex = Math.floor(Math.random() * unusedQuestions.length)
    return unusedQuestions[randomIndex] ?? null
  }
  // when called sends the question to the host of the room
  public async sendQuestionToRoom(hostSocket: ClientSocket, usedIds: string[] = []): Promise<void> {
    const membership = this.registry.lookup(hostSocket)
    if (!membership || membership.role !== 'host') return

    const question = await this.getRandomQuestion(usedIds)
    if (!question) return

    this.broadcaster.emitToRoom(membership.roomId, EVENTS.QUESTION_SHOW, {
      question: question.text,
    })
  }
}
