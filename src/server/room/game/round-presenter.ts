/**
 * @file round-presenter.ts
 * @owner server-squad
 * @description Presenter implementation that broadcasts question content to the room.
 */
import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Round } from '../../entities/round.entity.js'
import { RoundPresenter } from './game.types.js'
import { RoomBroadcaster } from '../lobby/room-broadcaster.js'
import * as EVENTS from '../../../shared/constants/socket-events.constants.js'

export const ROUND_PRESENTER = Symbol('ROUND_PRESENTER')

/** Midpoint of `Math.random()`'s [0, 1) range; used as the shuffle comparator pivot. */
const SHUFFLE_PIVOT = 0.5

@Injectable()
export class StubRoundPresenter implements RoundPresenter {
  private readonly logger = new Logger(StubRoundPresenter.name)

  public present(roomId: string, round: Round): void {
    this.logger.log(
      `Round ${round.roundIndex} content presentation is stubbed for room ${roomId} ` +
        `(question-display slice not yet wired)`
    )
  }
}

@Injectable()
export class RealRoundPresenter implements RoundPresenter {
  private readonly logger = new Logger(RealRoundPresenter.name)

  public constructor(
    private readonly broadcaster: RoomBroadcaster,
    @InjectRepository(Round) private readonly roundRepo: Repository<Round>
  ) {}

  public async present(roomId: string, round: Round): Promise<void> {
    let roundWithQuestion = round

    // Ensure question relation is loaded
    if (!round.question && round.questionId) {
      const loaded = await this.roundRepo.findOne({
        where: { id: round.id },
        relations: { question: true },
      })
      if (loaded) {
        roundWithQuestion = loaded
      }
    }

    const question = roundWithQuestion.question
    if (!question) {
      this.logger.error(`No question found for round ${round.id} in room ${roomId}`)
      return
    }

    const answersList = [
      ...question.correctAnswers.map((ans, idx) => ({ id: `correct-${idx}`, text: ans })),
      ...question.wrongAnswers.map((ans, idx) => ({ id: `wrong-${idx}`, text: ans })),
    ]

    // Simple deterministic shuffle so it's consistent for this broadcast but randomized for users
    const shuffledAnswers = [...answersList].sort(() => Math.random() - SHUFFLE_PIVOT)

    this.logger.log(`Broadcasting question for round ${round.roundIndex} to room ${roomId}`)

    this.broadcaster.emitToRoom(roomId, EVENTS.QUESTION_SHOW, {
      question: {
        id: question.id,
        text: question.text,
        answers: shuffledAnswers,
        timeLimit: round.timeLimitSeconds,
      },
    })
  }
}
