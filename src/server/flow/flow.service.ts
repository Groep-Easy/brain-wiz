/**
 * @file src/server/flow/flow.service.ts
 * @owner server-squad
 * @description Owns the game-flow building blocks: serving the catalog, building
 * server-side randomized flows, and validating/normalizing a host-built flow so
 * it is always playable. Theme blocks are only offered (and only randomized in)
 * when the matching theme actually has questions; question counts are clamped to
 * what exists. Minigame blocks are always offered (they are implemented modules).
 */
import 'reflect-metadata'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Repository } from 'typeorm'
import { GameBlock } from '../entities/game-block.entity'
import { Question } from '../entities/question.entity'
import { BlockKindEnum } from '../entities/enums'
import type { GameBlockDto, GameFlowItem } from '../../shared/types/flow'

/** Defaults mirror the host editor's per-block question range. */
const DEFAULT_QUESTIONS_PER_BLOCK = 5
const MIN_QUESTIONS_PER_BLOCK = 1
const MAX_QUESTIONS_PER_BLOCK = 20

const MIN_FLOW_BLOCKS = 2
const MAX_FLOW_BLOCKS = 15
const DEFAULT_FLOW_SIZE = 4

@Injectable()
export class FlowService {
  public constructor(
    @InjectRepository(GameBlock) private readonly blocks: Repository<GameBlock>,
    @InjectRepository(Question) private readonly questions: Repository<Question>
  ) {}

  /**
   * The palette a host can build from: theme blocks that currently have
   * questions, plus every enabled minigame block. Theme blocks carry an
   * `available` count so the host can clamp question counts.
   */
  public async getCatalog(): Promise<GameBlockDto[]> {
    const [palette, counts] = await Promise.all([
      this.blocks.find({ where: { enabled: true }, order: { sortOrder: 'ASC' } }),
      this.questionCountsByTheme(),
    ])

    const catalog: GameBlockDto[] = []
    for (const block of palette) {
      if (block.kind === BlockKindEnum.THEME) {
        const available = (block.theme && counts.get(block.theme)) || 0
        if (available <= 0) continue // hide themes with no playable content
        catalog.push({
          id: block.id,
          kind: 'theme',
          label: block.label,
          icon: block.icon,
          available,
        })
      } else {
        catalog.push({ id: block.id, kind: 'minigame', label: block.label, icon: block.icon })
      }
    }
    return catalog
  }

  /**
   * Build a randomized, guaranteed-playable flow of `size` blocks from the
   * catalog (with replacement, like the host's editor). Returns [] when there is
   * no playable content at all.
   */
  public async randomize(size = DEFAULT_FLOW_SIZE): Promise<GameFlowItem[]> {
    const count = this.clampFlowSize(size)
    const catalog = await this.getCatalog()
    if (catalog.length === 0) return []

    const shuffled = this.shuffle([...catalog])
    const flow: GameFlowItem[] = []
    for (let i = 0; i < count; i++) {
      const pick = shuffled[i % shuffled.length]
      if (!pick) continue
      flow.push(this.toFlowItem(pick.id, pick.kind, pick.available, undefined))
    }
    return flow
  }

  private shuffle<T>(items: T[]): T[] {
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

  /** Validate and normalize a host-built flow so it is always playable. */
  public async normalizeForStorage(flow: GameFlowItem[]): Promise<GameFlowItem[]> {
    const catalog = await this.getCatalog()
    const byId = new Map(catalog.map((b) => [b.id, b]))

    return flow.flatMap((item) => {
      const block = byId.get(item.blockId)
      return block ? [this.toFlowItem(block.id, block.kind, block.available, item.questions)] : []
    })
  }

  /** Map a catalog entry + requested count into a stored flow item. */
  private toFlowItem(
    blockId: string,
    kind: GameBlockDto['kind'],
    available: number | undefined,
    requested: number | undefined
  ): GameFlowItem {
    if (kind !== 'theme') {
      return { blockId }
    }
    const cap = Math.min(MAX_QUESTIONS_PER_BLOCK, available ?? MAX_QUESTIONS_PER_BLOCK)
    const desired = requested ?? DEFAULT_QUESTIONS_PER_BLOCK
    const questions = Math.max(MIN_QUESTIONS_PER_BLOCK, Math.min(cap, Math.round(desired)))
    return { blockId, questions }
  }

  /** Clamp the flow size to the allowed range. Defaults to the editor's default. */
  private clampFlowSize(size: number): number {
    const n = Math.round(size) || DEFAULT_FLOW_SIZE
    return Math.max(MIN_FLOW_BLOCKS, Math.min(MAX_FLOW_BLOCKS, n))
  }

  /** Query how many questions the database has for each theme, to clamp the host's requested counts. */
  private async questionCountsByTheme(): Promise<Map<string, number>> {
    const rows = await this.questions
      .createQueryBuilder('q')
      .select('q.theme', 'theme')
      .addSelect('COUNT(*)', 'count')
      .groupBy('q.theme')
      .getRawMany<{ theme: string; count: string }>()
    return new Map(rows.map((r) => [r.theme, Number(r.count)]))
  }
}
