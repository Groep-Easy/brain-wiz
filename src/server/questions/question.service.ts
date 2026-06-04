/**
 * @file question.service.ts
 * @description Handles question-related database operations and broadcasting
 * questions to rooms over WebSocket.
 */
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Question } from '../entities/question.entity.js'
import { ConnectionRegistry } from '../room/lobby/connection-registry.js'
import { RoomBroadcaster } from '../room/lobby/room-broadcaster.js'
import * as EVENTS from '../../shared/events/socket-events.js'
import type { ClientSocket } from '../room/lobby/lobby.types.js'

@Injectable()
export class QuestionService {
  public constructor(
    @InjectRepository(Question)
    private readonly questionRepo: Repository<Question>,
    private readonly registry: ConnectionRegistry,
    private readonly broadcaster: RoomBroadcaster,
  ) {}

  // gets random question from the database
  public async getRandomQuestion(): Promise<Question | null> {
    const questions = await this.questionRepo.find()
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
