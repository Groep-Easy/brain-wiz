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

  /**
   * Get a question by ID
   */
  public async getQuestionById(id: string): Promise<Question | null> {
    return this.questionRepo.findOne({ where: { id } })
  }

  /**
   * Fetch a question and broadcast it to every socket in the host's room.
   * Called when the host sends GAME_START.
   *
   * - correctAnswer is intentionally excluded from the payload so clients
   *   cannot read it from the wire. It is revealed later via QUESTION_REVEAL.
   */
  public async sendQuestionToRoom(hostSocket: ClientSocket, questionId: string): Promise<void> {
    const membership = this.registry.lookup(hostSocket)
    if (!membership || membership.role !== 'host') return

    const question = await this.getQuestionById(questionId)
    if (!question) return

    this.broadcaster.emitToRoom(membership.roomId, EVENTS.QUESTION_SHOW, {
      question: {text: question.text},
    })
  }
}
