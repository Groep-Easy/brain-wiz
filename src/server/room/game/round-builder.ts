/**
 * @file round-builder.ts
 * @owner server-squad
 * @description Pre-builds the round sequence for a game. When the room has a
 * host-built flow (`room.gameFlow`), it expands that flow into rounds: each
 * theme block becomes up to N distinct questions of that theme; mini-game blocks
 * are skipped for now (the engine does not yet drive mini-game rounds). When no
 * flow is set it falls back to the MVP behaviour: `count` random distinct
 * questions.
 */
import 'reflect-metadata'
import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Repository } from 'typeorm'
import { Question } from '../../entities/question.entity'
import { Round } from '../../entities/round.entity'
import { Room } from '../../entities/room.entity'
import { GameBlock } from '../../entities/game-block.entity'
import { RoundStatusEnum, ContentTypeEnum, BlockKindEnum } from '../../entities/enums'
import { TIMER } from '../../../shared/constants/game-config'
import { NotEnoughQuestionsError } from './game.errors'

const DEFAULT_QUESTIONS_PER_BLOCK = 5

@Injectable()
export class RoundBuilder {
  private readonly logger = new Logger(RoundBuilder.name)

  public constructor(
    @InjectRepository(Question) private readonly questions: Repository<Question>,
    @InjectRepository(Round) private readonly rounds: Repository<Round>,
    @InjectRepository(Room) private readonly roomRepo: Repository<Room>,
    @InjectRepository(GameBlock) private readonly blocks: Repository<GameBlock>
  ) {}

  /**
   * Build the round sequence. If the room has a custom flow, expand it; the
   * `count` argument is then only the fallback for flowless (MVP) games.
   */
  public async buildRounds(room: Room, count: number): Promise<Round[]> {
    const flow = room.gameFlow ?? []
    const chosen = flow.length > 0 ? await this.pickFromFlow(room) : await this.pickRandom(count)

    if (chosen.length === 0) {
      throw new NotEnoughQuestionsError(flow.length > 0 ? 1 : count, 0)
    }

    const built: Round[] = []
    let index = 0
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

  /**
   * Expand a host-built flow into an ordered question list. Each theme block
   * contributes up to its requested count of distinct questions of that theme,
   * never repeating a question within the game. Mini-game blocks are recorded in
   * the flow for display but skipped here — driving mini-game rounds is not yet
   * implemented in the engine.
   */
  private async pickFromFlow(room: Room): Promise<Question[]> {
    const catalog = await this.blocks.find()
    const blockById = new Map(catalog.map((b) => [b.id, b]))
    const pool = await this.questions.find()
    // Group the question pool by theme so we can hand out distinct questions.
    const byTheme = new Map<string, Question[]>()
    for (const q of pool) {
      const list = byTheme.get(q.theme) ?? []
      list.push(q)
      byTheme.set(q.theme, list)
    }
    for (const [theme, list] of byTheme) {
      byTheme.set(theme, this.shuffled(list))
    }

    const chosen: Question[] = []
    let skippedMinigames = 0
    for (const item of room.gameFlow) {
      const block = blockById.get(item.blockId)
      if (!block) continue
      if (block.kind !== BlockKindEnum.THEME || !block.theme) {
        skippedMinigames++
        continue
      }
      const available = byTheme.get(block.theme) ?? []
      const want = item.questions ?? DEFAULT_QUESTIONS_PER_BLOCK
      for (let n = 0; n < want; n++) {
        const next = available.pop()
        if (!next) break
        chosen.push(next)
      }
    }

    if (skippedMinigames > 0) {
      this.logger.warn(
        `Skipped ${skippedMinigames} mini-game block(s) in room ${room.id}: ` +
          `mini-game rounds are not yet supported by the engine.`
      )
    }
    return chosen
  }

  /** MVP fallback: `count` distinct random questions (selection without replacement). */
  private async pickRandom(count: number): Promise<Question[]> {
    const pool = await this.questions.find()
    if (pool.length < count) {
      throw new NotEnoughQuestionsError(count, pool.length)
    }
    return this.shuffled([...pool]).slice(0, count)
  }

  /** Fisher–Yates shuffle, returning the same array reference (shuffled in place). */
  private shuffled<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const a = items[i]
      const b = items[j]
      if (a === undefined || b === undefined) continue
      items[i] = b
      items[j] = a
    }
    return items
  }
}
