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
import type { Answer, QuestionShowPayload, RoundContentPayload } from '../../../shared/types/index'
import * as EVENTS from '../../../shared/constants/socket-events.constants'
import { MinigameRegistry } from './minigames/minigame-registry'

@Injectable()
export class RoundPresenterImpl implements RoundPresenter {
  private readonly logger = new Logger(RoundPresenterImpl.name)

  public constructor(
    private readonly broadcaster: RoomBroadcaster,
    private readonly bus: GameEventBus,
    private readonly minigames?: MinigameRegistry
  ) {}

  public async present(roomId: string, round: Round): Promise<void> {
    if ((round.gameType ?? 'quiz') !== 'quiz') {
      this.presentProcedural(roomId, round)
      return
    }

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
      roundType: 'quiz',
      scoringMode: 'quiz',
      questionId: question.id,
      shownAt,
      timeLimitSeconds: round.timeLimitSeconds,
      basePoints: question.basePoints,
      options,
    })
  }

  private presentProcedural(roomId: string, round: Round): void {
    const adapter = this.minigames?.get(round.gameType)
    if (!adapter) {
      this.logger.warn(`No minigame adapter for round ${round.id} (${round.gameType})`)
      return
    }
    if (!round.publicState || !round.privateState || !round.scoringConfig || !round.seed) {
      this.logger.warn(`Procedural round ${round.id} is missing generated state`)
      return
    }

    const shownAt = Date.now()
    const answerChoices = adapter.getAnswerChoices?.(round.publicState)
    const payload: RoundContentPayload = {
      roundId: round.id,
      type: adapter.type,
      seed: round.seed,
      publicState: round.publicState,
      ...(answerChoices ? { answerChoices } : {}),
      timeLimitSeconds: round.timeLimitSeconds,
    }
    this.broadcaster.emitToRoom(roomId, EVENTS.ROUND_CONTENT_SHOW, payload)
    this.bus.publish({
      type: 'ROUND_WINDOW_OPENED',
      roomId,
      roundId: round.id,
      roundType: adapter.type,
      scoringMode: 'minigame',
      shownAt,
      timeLimitSeconds: round.timeLimitSeconds,
      privateState: round.privateState,
      scoringConfig: round.scoringConfig,
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
