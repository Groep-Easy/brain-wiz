import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Repository } from 'typeorm'
import { Question } from '../entities/question.entity.js'
import type { CreateQuestionDto } from './dto/create-question.dto.js'
import { ConnectionRegistry } from '../room/lobby/connection-registry.js'
import { RoomBroadcaster } from '../room/lobby/room-broadcaster.js'
import * as EVENTS from '../../shared/events/socket-events.js'
import type { ClientSocket } from '../room/lobby/lobby.types.js'

const MAX_ANSWERS = 2

@Injectable()
export class QuestionService {
  public constructor(
    @InjectRepository(Question) private readonly questions: Repository<Question>,
    private readonly registry: ConnectionRegistry,
    private readonly broadcaster: RoomBroadcaster
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


  // gets random question from the database
    public async getRandomQuestion(): Promise<Question | null> {
      const questions = await this.questions.find()
      if (questions.length === 0) return null

      const randomIndex = Math.floor(Math.random() * questions.length)
      return questions[randomIndex] ?? null
    }

    // when called sends the question to the host of the room
    public async sendQuestionToRoom(hostSocket: ClientSocket): Promise<void> {
      const membership = this.registry.lookup(hostSocket)
      if (!membership || membership.role !== 'host') return

      const question = await this.getRandomQuestion()
      if (!question) return

      this.broadcaster.emitToRoom(membership.roomId, EVENTS.QUESTION_SHOW, {
        question: question.text,
      })
    }
}
