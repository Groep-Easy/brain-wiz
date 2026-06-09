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
import { randomUUID } from 'node:crypto'
import type { Repository } from 'typeorm'
import { Question } from '../../entities/question.entity'
import { Round } from '../../entities/round.entity'
import { Room } from '../../entities/room.entity'
import { RoundStatusEnum, ContentTypeEnum } from '../../entities/enums'
import { ROUNDS, TIMER } from '../../../shared/constants/game-config'
import type { RoundType } from '../../../shared/types/index'
import { NotEnoughQuestionsError } from './game.errors'
import { MinigameRegistry } from './minigames/minigame-registry'

const PROCEDURAL_ROUND_SEED_SEPARATOR = ':'

interface ProceduralRoundSeedInput {
  roomId: string
  roundId: string
  type: RoundType
}

function createProceduralRoundSeed({ roomId, roundId, type }: ProceduralRoundSeedInput): string {
  return [roomId, roundId, type].join(PROCEDURAL_ROUND_SEED_SEPARATOR)
}

@Injectable()
export class RoundBuilder {
  public constructor(
    @InjectRepository(Question) private readonly questions: Repository<Question>,
    @InjectRepository(Round) private readonly rounds: Repository<Round>,
    @InjectRepository(Room) private readonly roomRepo: Repository<Room>,
    private readonly minigames: MinigameRegistry
  ) {}

  public async buildRounds(room: Room, count: number): Promise<Round[]> {
    const sequence = this.roundSequence(count)
    const quizCount = sequence.filter((type) => type === 'quiz').length
    const pool = await this.questions.find()
    if (pool.length < quizCount) {
      throw new NotEnoughQuestionsError(quizCount, pool.length)
    }

    const chosen = this.pickQuestions(pool, quizCount)
    if (chosen.length !== quizCount) {
      throw new NotEnoughQuestionsError(quizCount, chosen.length)
    }

    const built: Round[] = []
    let quizIndex = 0
    for (let index = 0; index < sequence.length; index += 1) {
      const type = sequence[index] ?? 'quiz'
      if (type === 'quiz') {
        const question = chosen[quizIndex]
        if (!question) {
          throw new NotEnoughQuestionsError(quizCount, chosen.length)
        }
        built.push(await this.saveQuizRound(room, index, question))
        quizIndex += 1
      } else {
        built.push(await this.saveProceduralRound(room, index, type))
      }
    }

    room.totalRounds = built.length
    await this.roomRepo.save(room)
    return built
  }

  private roundSequence(count: number): RoundType[] {
    const sequence: RoundType[] = []
    for (let index = 0; index < count; index += 1) {
      sequence.push(ROUNDS.DEFAULT_SEQUENCE[index % ROUNDS.DEFAULT_SEQUENCE.length] ?? 'quiz')
    }
    return sequence
  }

  private async saveQuizRound(room: Room, index: number, question: Question): Promise<Round> {
    const round = this.rounds.create({
      roomId: room.id,
      roundIndex: index,
      status: RoundStatusEnum.PENDING,
      contentType: ContentTypeEnum.QUESTION,
      gameType: 'quiz',
      timeLimitSeconds: TIMER.QUESTION_SECONDS,
      question,
    })
    return this.rounds.save(round)
  }

  private async saveProceduralRound(room: Room, index: number, type: RoundType): Promise<Round> {
    const adapter = this.minigames.get(type)
    if (!adapter) {
      throw new Error(`No minigame adapter registered for round type "${type}"`)
    }
    const roundId = randomUUID()
    const seed = createProceduralRoundSeed({
      roomId: room.id,
      roundId,
      type,
    })
    const generated = adapter.createRound({
      roundId,
      seed,
      roundIndex: index,
      timeLimitSeconds: TIMER.QUESTION_SECONDS,
    })
    const round = this.rounds.create({
      id: roundId,
      roomId: room.id,
      roundIndex: index,
      status: RoundStatusEnum.PENDING,
      contentType: ContentTypeEnum.PUZZLE,
      gameType: generated.type,
      seed: generated.seed,
      publicState: generated.publicState,
      privateState: generated.privateState,
      scoringConfig: generated.scoringConfig,
      timeLimitSeconds: TIMER.QUESTION_SECONDS,
    })
    return this.rounds.save(round)
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
