/**
 * @file src/server/database/block-seeder.service.ts
 * @description Seeds the `game_blocks` catalog on application bootstrap. Upserts
 * the canonical block definitions (see block-seed-data.ts) so the host palette
 * is served from the database rather than hardcoded in the frontend. Idempotent:
 * existing rows are refreshed (label/icon/order), new rows are inserted.
 */
import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { GameBlock } from '../entities/game-block.entity'
import { BLOCK_SEED } from './block-seed-data'

@Injectable()
export class BlockSeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BlockSeederService.name)

  public constructor(@InjectRepository(GameBlock) private readonly blocks: Repository<GameBlock>) {}

  public async onApplicationBootstrap(): Promise<void> {
    try {
      await this.seedBlocks()
    } catch (error) {
      this.logger.error(
        `Failed to seed game blocks: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  private async seedBlocks(): Promise<void> {
    let inserted = 0
    let updated = 0

    for (const [i, seed] of BLOCK_SEED.entries()) {
      const existing = await this.blocks.findOne({ where: { id: seed.id } })
      if (existing) {
        existing.kind = seed.kind
        existing.label = seed.label
        existing.icon = seed.icon
        existing.theme = seed.theme
        existing.minigameKey = seed.minigameKey
        existing.sortOrder = i
        await this.blocks.save(existing)
        updated++
      } else {
        await this.blocks.save(
          this.blocks.create({
            id: seed.id,
            kind: seed.kind,
            label: seed.label,
            icon: seed.icon,
            theme: seed.theme,
            minigameKey: seed.minigameKey,
            sortOrder: i,
            enabled: true,
          })
        )
        inserted++
      }
    }

    this.logger.log(`Seeded game blocks: ${inserted} inserted, ${updated} refreshed.`)
  }
}
