/**
 * @file scoring.service.ts
 * @description Scores a round when its answer window closes: time-decay points
 * for correct answers, 0 for wrong, roster members with no submission reported
 * as timeouts. Updates client.totalScore, broadcasts QUESTION_REVEAL, then
 * publishes ROUND_SCORED so the engine can proceed to ROUND_END.
 */
import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Repository } from 'typeorm'
import { ClientAnswer } from '../../entities/client-answer.entity'
import { RoomBroadcaster } from '../lobby/room-broadcaster'
import { ClientService } from '../../client/client.service'
import { GameEventBus } from './game-event-bus'
import type { RoundOption } from './game-events'
import type { PlayerAnswerResult, QuestionRevealPayload } from '../../../shared/types/index'
import * as EVENTS from '../../../shared/events/socket-events'

const MS_PER_SECOND = 1000

interface ScoringContext {
  roundId: string
  options: Map<string, RoundOption>
  timeLimitMs: number
  basePoints: number
}

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name)
  private readonly contexts = new Map<string, ScoringContext>()

  public constructor(
    private readonly bus: GameEventBus,
    private readonly broadcaster: RoomBroadcaster,
    @InjectRepository(ClientAnswer) private readonly answers: Repository<ClientAnswer>,
    private readonly clients: ClientService
  ) {
    this.bus.on('ROUND_WINDOW_OPENED').subscribe((e) => {
      this.contexts.set(e.roomId, {
        roundId: e.roundId,
        options: new Map(e.options.map((o) => [o.id, o])),
        timeLimitMs: e.timeLimitSeconds * MS_PER_SECOND,
        basePoints: e.basePoints,
      })
    })
    this.bus.on('ROUND_WINDOW_CLOSED').subscribe((e) => {
      void this.scoreRound(e.roomId, e.roundId)
    })
    this.bus.on('ROUND_WINDOW_ABORTED').subscribe((e) => {
      this.contexts.delete(e.roomId)
    })
  }

  private async scoreRound(roomId: string, roundId: string): Promise<void> {
    try {
      const ctx = this.contexts.get(roomId)
      if (!ctx) {
        return
      }
      const rows = await this.answers.find({ where: { roundId } })
      const roster = await this.clients.findByRoom(roomId)
      const playerAnswers: Record<string, PlayerAnswerResult> = {}
      const answered = new Set<string>()

      for (const row of rows) {
        answered.add(row.clientId)
        const option = ctx.options.get(row.answerValue)
        const isCorrect = option?.isCorrect ?? false
        const points = isCorrect ? this.points(ctx, row.timeToAnswerMs ?? 0) : 0
        row.isCorrect = isCorrect
        row.pointsAwarded = points
        await this.answers.save(row)
        if (points > 0) {
          const client = roster.find((c) => c.id === row.clientId)
          if (client) {
            await this.clients.addScore(client, points)
          }
        }
        playerAnswers[row.clientId] = {
          answerId: row.answerValue,
          isCorrect,
          pointsAwarded: points,
          isTimeout: false,
        }
      }

      for (const client of roster) {
        if (!answered.has(client.id)) {
          playerAnswers[client.id] = {
            answerId: null,
            isCorrect: false,
            pointsAwarded: 0,
            isTimeout: true,
          }
        }
      }

      const correctAnswerIds = [...ctx.options.values()].filter((o) => o.isCorrect).map((o) => o.id)
      const reveal: QuestionRevealPayload = { roundId, correctAnswerIds, playerAnswers }
      this.broadcaster.emitToRoom(roomId, EVENTS.QUESTION_REVEAL, reveal)
    } catch (error) {
      this.logger.error(`Scoring failed for room ${roomId}: ${String(error)}`)
    } finally {
      this.contexts.delete(roomId)
      this.bus.publish({ type: 'ROUND_SCORED', roomId, roundId })
    }
  }

  private points(ctx: ScoringContext, timeToAnswerMs: number): number {
    const remaining = ctx.timeLimitMs - timeToAnswerMs
    const clamped = Math.max(0, Math.min(ctx.timeLimitMs, remaining))
    return Math.round(ctx.basePoints * (clamped / ctx.timeLimitMs))
  }
}
