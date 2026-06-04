import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Repository } from 'typeorm'
import { Question } from '../entities/question.entity.js'
import type { CreateQuestionDto } from './dto/create-question.dto.js'
import { ConnectionRegistry } from '../room/lobby/connection-registry.js'
import { RoomBroadcaster } from '../room/lobby/room-broadcaster.js'
import * as EVENTS from '../../shared/events/socket-events.js'
import type { ClientSocket } from '../room/lobby/lobby.types.js'
import { RoomService } from '../room/room.service.js'

const MAX_ANSWERS = 2

@Injectable()
export class QuestionService {
  public constructor(
    @InjectRepository(Question) private readonly questions: Repository<Question>,
    private readonly registry: ConnectionRegistry,
    private readonly broadcaster: RoomBroadcaster,
    private readonly roomService: RoomService
  ) {}

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
      // eslint-disable-next-line no-console
      console.error('Failed to save question:', error)
      throw new InternalServerErrorException('Failed to save question to database')
    }
  }

  // gets random unused question from the database
  public async getRandomQuestion(usedIds: string[]): Promise<Question | null> {
    const questions = await this.questions.find()
    const unusedQuestions = questions.filter((q) => !usedIds.includes(q.id))
    if (unusedQuestions.length === 0) return null

    const randomIndex = Math.floor(Math.random() * unusedQuestions.length)
    return unusedQuestions[randomIndex] ?? null
  }

  // when called sends the question to the host of the room
  public async sendQuestionToRoom(hostSocket: ClientSocket): Promise<void> {
    const membership = this.registry.lookup(hostSocket)
    if (!membership || membership.role !== 'host') return

    const room = await this.roomService.findById(membership.roomId)
    if (!room) return

    console.log('room id:', room.id)
    console.log('usedQuestionIds before:', room.usedQuestionsIds)

    const question = await this.getRandomQuestion(room.usedQuestionsIds)
    if (!question) return

    room.usedQuestionsIds = [...room.usedQuestionsIds, question.id]
    console.log('question id to save:', question.id)
    await this.roomService.appendUsedQuestionsId(membership.roomId, question.id)
    console.log('usedQuestionIds after:', room.usedQuestionsIds)


    // const question = await this.getRandomQuestion()
    // if (!question) return

    this.broadcaster.emitToRoom(membership.roomId, EVENTS.QUESTION_SHOW, {
      question: question.text,
    })
  }
}
