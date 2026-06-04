/**
 * @file round-presenter.ts
 * @owner server-squad
 * @description Seam between the game engine (owns WHEN the QUESTION phase
 * happens) and the question-display slice (owns SHOWING the question). The
 * engine depends on the ROUND_PRESENTER token; this module provides a stub the
 * question team replaces with a binding that emits QUESTION_SHOW.
 */
import { Logger } from '@nestjs/common'
import type { Round } from '../../entities/round.entity.js'
import { RoundPresenter } from './game.types.js'

export const ROUND_PRESENTER = Symbol('ROUND_PRESENTER')

export class StubRoundPresenter implements RoundPresenter {
  private readonly logger = new Logger(StubRoundPresenter.name)

  public present(roomId: string, round: Round): void {
    this.logger.log(
      `Round ${round.roundIndex} content presentation is stubbed for room ${roomId} ` +
        `(question-display slice not yet wired)`
    )
  }
}
