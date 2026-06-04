/**
 * @file src/server/entities/puzzle.entity.ts
 * @description Puzzle content entity
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm'
import { DifficultyEnum } from './enums'
import type { Round } from './round.entity'

/**
 * Puzzle entity - represents a logic/pattern/visual puzzle
 * More flexible than questions - can have various formats stored as JSON config
 * Multiple rooms can use the same puzzle across different sessions
 */
@Entity('puzzles')
@Index('idx_puzzles_type', ['puzzleType'])
export class Puzzle {
  @PrimaryGeneratedColumn('uuid')
  public id!: string

  /**
   * Puzzle name/title
   * CONSTRAINT: NOT NULL
   */
  @Column('varchar', { length: 256 })
  public title!: string

  /**
   * Detailed puzzle description/problem statement
   * CONSTRAINT: NOT NULL
   */
  @Column('text')
  public description!: string

  /**
   * Type of puzzle for filtering
   * Examples: 'maze', 'pattern', 'logic', 'visual', 'sequence'
   * CONSTRAINT: NOT NULL
   */
  @Column('varchar', { length: 64 })
  public puzzleType!: string

  /**
   * Puzzle-specific configuration as JSON
   * Structure depends on puzzleType:
   * - maze: { layout, startPos, endPos, solution }
   * - pattern: { sequence, rule, answers }
   * - visual: { imageUrl, highlightRegions, answers }
   * Defaults to empty object if not needed
   */
  @Column('jsonb', { default: {} })
  public config: Record<string, unknown> = {}

  /**
   * Difficulty level
   * CONSTRAINT: NOT NULL
   */
  @Column('enum', { enum: DifficultyEnum })
  public difficulty!: DifficultyEnum

  /**
   * Path to puzzle image/visual
   * CONSTRAINT: NOT NULL
   */
  @Column('varchar', { length: 512 })
  public imagePath!: string

  /**
   * Time limit in seconds
   */
  @Column('smallint', { nullable: true })
  public timeLimitSeconds: number | null = null

  /**
   * Maximum points awardable for this puzzle
   * CONSTRAINT: NOT NULL, default 1000
   */
  @Column('smallint', { default: 1000 })
  public maxPoints!: number

  @CreateDateColumn()
  public createdAt!: Date

  @UpdateDateColumn()
  public updatedAt!: Date

  /**
   * Relationship: rounds that use this puzzle
   */
  @OneToMany('Round', 'puzzle', { onDelete: 'RESTRICT' })
  public rounds!: Round[]
}
