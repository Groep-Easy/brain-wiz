/**
 * @file round-builder.ts
 * @owner server-squad
 * @description Pre-builds the round sequence for a game. MVP: quiz-only with
 * random distinct questions. This is the seam the future theme/round-selection
 * feature plugs into (it will replace `pickQuestions`).
 */
import 'reflect-metadata'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Repository } from 'typeorm'
import { Question } from '../../entities/question.entity'
import { Round } from '../../entities/round.entity'
import { Room } from '../../entities/room.entity'
import { RoundStatusEnum, ContentTypeEnum } from '../../entities/enums'
import { TIMER } from '../../../shared/constants/game-config'
import { NotEnoughQuestionsError } from './game.errors'

@Injectable()
export class RoundBuilder {
  public constructor(
    @InjectRepository(Question) private readonly questions: Repository<Question>,
    @InjectRepository(Round) private readonly rounds: Repository<Round>,
    @InjectRepository(Room) private readonly roomRepo: Repository<Room>
  ) {}

  public async buildRounds(room: Room, count: number): Promise<Round[]> {
    const pool = await this.questions.find()
    if (pool.length < count) {
      throw new NotEnoughQuestionsError(count, pool.length)
    }

    const chosen = this.pickQuestions(pool, count)
    if (chosen.length !== count) {
      throw new NotEnoughQuestionsError(count, chosen.length)
    }

    const built: Round[] = []
    let index = 1
    for (const question of chosen) {
      const round = this.rounds.create({
        roomId: room.id,
        roundIndex: index,
        status: RoundStatusEnum.PENDING,
        contentType: ContentTypeEnum.QUESTION,
        timeLimitSeconds: TIMER.QUESTION_SECONDS,
        question,
      })
      built.push(await this.rounds.save(round))
      index++
    }

    room.totalRounds = built.length
    await this.roomRepo.save(room)
    return built
  }

  /** Pick `count` distinct random questions (selection without replacement). */
  private pickQuestions(pool: Question[], count: number): Question[] {
    const remaining = [...pool]
    const chosen: Question[] = []
    for (let n = 0; n < count; n++) {
      const index = Math.floor(Math.random() * remaining.length)
      const [picked] = remaining.splice(index, 1)
      if (picked !== undefined) {
        chosen.push(picked)
      }
    }
    return chosen
  }
}
