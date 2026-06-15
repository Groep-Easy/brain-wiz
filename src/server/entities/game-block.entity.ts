/**
 * @file src/server/entities/game-block.entity.ts
 * @description Catalog of the building blocks a host can place in a game flow.
 *
 * This is the server-side source of truth for the palette that used to live
 * hardcoded in the host's `blocks.ts`. Theme blocks map to a QuestionThemeEnum
 * (and are only offered when that theme has questions); minigame blocks map to
 * an implemented mini-game module. The table is populated by BlockSeederService.
 */
import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'
import { BlockKindEnum, QuestionThemeEnum } from './enums'

@Entity('game_blocks')
export class GameBlock {
  @PrimaryColumn('varchar', { length: 64 })
  public id!: string

  @Column('enum', { enum: BlockKindEnum })
  public kind!: BlockKindEnum

  @Column('varchar', { length: 64 })
  public label!: string

  @Column('varchar', { length: 16, default: '' })
  public icon!: string

  @Column('enum', { enum: QuestionThemeEnum, nullable: true })
  public theme: QuestionThemeEnum | null = null

  @Column('varchar', { length: 64, nullable: true })
  public minigameKey: string | null = null

  @Column('smallint', { default: 0 })
  public sortOrder!: number

  @Column('boolean', { default: true })
  public enabled!: boolean

  @CreateDateColumn()
  public createdAt!: Date

  @UpdateDateColumn()
  public updatedAt!: Date
}
