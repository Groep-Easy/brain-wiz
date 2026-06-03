/**
 * @file src/server/entities/question.entity.ts
 * @description Trivia question content entity
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm'
import { DifficultyEnum, QuestionThemeEnum } from './enums.js'
import type { Round } from './round.entity.js'

const MIN_ANSWERS = 1
const MAX_ANSWERS = 2

/**
 * Question entity - represents a trivia question in the content pool
 * Multiple rooms can use the same question across different sessions
 */
@Entity('questions')
@Index('idx_questions_theme_difficulty', ['theme', 'difficulty'])
export class Question {
  @PrimaryGeneratedColumn('uuid')
  public id!: string

  /**
   * Question text - limited to 512 chars for display on mobile
   * CONSTRAINT: NOT NULL
   */
  @Column('varchar', { length: 512 })
  public text!: string

  /**
   * Question category for filtering and balancing
   * CONSTRAINT: NOT NULL
   */
  @Column('enum', { enum: QuestionThemeEnum })
  public theme!: QuestionThemeEnum

  /**
   * Difficulty level affects point scaling
   * CONSTRAINT: NOT NULL
   */
  @Column('enum', { enum: DifficultyEnum })
  public difficulty!: DifficultyEnum

  @Column('text', { array: true, default: [] })
  public correctAnswers!: string[]

  @Column('text', { array: true, default: [] })
  public wrongAnswers!: string[]

  /**
   * Path to question image (relative or absolute URL)
   * CONSTRAINT: NOT NULL
   */
  @Column('varchar', { length: 512 })
  public imagePath!: string

  /**
   * Time limit for answering in seconds
   * If NULL, no time limit (warning: could cause game to hang)
   */
  @Column('smallint', { nullable: true })
  public timeLimitSeconds: number | null = null

  /**
   * Base points awarded for correct answer
   * Actual points = base_points * (time_remaining / time_limit)
   * CONSTRAINT: NOT NULL, default 1000
   */
  @Column('smallint', { default: 1000 })
  public basePoints!: number

  @CreateDateColumn()
  public createdAt!: Date

  @UpdateDateColumn()
  public updatedAt!: Date

  /**
   * Relationship: rounds that use this question
   */
  @OneToMany('Round', 'question', { onDelete: 'RESTRICT' })
  public rounds!: Round[]

  /**
   * Validate answers length constraints
   * Called before insert/update
   */
  @BeforeInsert()
  @BeforeUpdate()
  public validateAnswers(): void {
    if (
      !Array.isArray(this.correctAnswers) ||
      this.correctAnswers.length < MIN_ANSWERS ||
      this.correctAnswers.length > MAX_ANSWERS
    ) {
      throw new Error(
        `Question must have between ${MIN_ANSWERS} and ${MAX_ANSWERS} correct answers`
      )
    }

    if (!Array.isArray(this.wrongAnswers) || this.wrongAnswers.length > 1) {
      throw new Error('Question can have a maximum of 1 wrong answer')
    }

    const totalAnswers = this.correctAnswers.length + this.wrongAnswers.length
    if (totalAnswers !== MAX_ANSWERS) {
      throw new Error(`Question must have exactly ${MAX_ANSWERS} possible answers`)
    }
  }
}
