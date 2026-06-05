/**
 * @file round-presenter.impl.ts
 * @description Real ROUND_PRESENTER binding. Builds the QuestionState (shuffled
 * options with stable ids), emits QUESTION_SHOW to the room, and opens the
 * answer window on the bus. It is the single source of truth for answer ids.
 */
import { Injectable, Logger } from '@nestjs/common'
import { RoomBroadcaster } from '../lobby/room-broadcaster'
import { GameEventBus } from './game-event-bus'
import type { RoundPresenter } from './game.types'
import type { Round } from '../../entities/round.entity'
import type { RoundOption } from './game-events'
import type { Answer, QuestionShowPayload } from '../../../shared/types/index'
import * as EVENTS from '../../../shared/events/socket-events'

@Injectable()
export class RoundPresenterImpl implements RoundPresenter {
  private readonly logger = new Logger(RoundPresenterImpl.name)

  public constructor(
    private readonly broadcaster: RoomBroadcaster,
    private readonly bus: GameEventBus
  ) {}

  public async present(roomId: string, round: Round): Promise<void> {
    const question = round.question
    if (!question) {
      this.logger.warn(
        `Round ${round.id} in room ${roomId} has no question; skipping QUESTION_SHOW`
      )
      return
    }

    const options = this.buildOptions(round.id, question.correctAnswers, question.wrongAnswers)
    const shownAt = Date.now()

    const answers: Answer[] = options.map((o) => ({ id: o.id, text: o.text }))
    const payload: QuestionShowPayload = {
      question: {
        id: round.id,
        text: question.text,
        answers,
        timeLimit: round.timeLimitSeconds,
      },
    }
    this.broadcaster.emitToRoom(roomId, EVENTS.QUESTION_SHOW, payload)

    this.bus.publish({
      type: 'ROUND_WINDOW_OPENED',
      roomId,
      roundId: round.id,
      questionId: question.id,
      shownAt,
      timeLimitSeconds: round.timeLimitSeconds,
      basePoints: question.basePoints,
      options,
    })
  }

  /** Combine correct + wrong answers, shuffle, and assign stable per-round ids. */
  private buildOptions(roundId: string, correct: string[], wrong: string[]): RoundOption[] {
    const labelled = [
      ...correct.map((text) => ({ text, isCorrect: true })),
      ...wrong.map((text) => ({ text, isCorrect: false })),
    ]
    const shuffled = this.shuffle(labelled)
    return shuffled.map((o, index) => ({
      id: `${roundId}:${index}`,
      text: o.text,
      isCorrect: o.isCorrect,
    }))
  }

  /** Fisher-Yates shuffle (returns a new array). */
  private shuffle<T>(items: T[]): T[] {
    const out = [...items]
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const a = out[i] as T
      out[i] = out[j] as T
      out[j] = a
    }
    return out
  }
}
