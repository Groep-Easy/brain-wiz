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

/**
 * Question entity - represents a trivia question in the content pool
 * Multiple rooms can use the same question across different sessions
 */
@Entity('questions')
@Index('idx_questions_theme_difficulty', ['theme', 'difficulty'])
export class Question {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  /**
   * Question text - limited to 512 chars for display on mobile
   * CONSTRAINT: NOT NULL
   */
  @Column('varchar', { length: 512 })
  text!: string

  /**
   * Question category for filtering and balancing
   * CONSTRAINT: NOT NULL
   */
  @Column('enum', { enum: QuestionThemeEnum })
  theme!: QuestionThemeEnum

  /**
   * Difficulty level affects point scaling
   * CONSTRAINT: NOT NULL
   */
  @Column('enum', { enum: DifficultyEnum })
  difficulty!: DifficultyEnum

  /**
   * The correct answer - limited to 256 chars
   * CONSTRAINT: NOT NULL
   */
  @Column('varchar', { length: 256 })
  correctAnswer!: string

  /**
   * Array of wrong answer options - exactly 3 required
   * CONSTRAINT: array_length must be 3
   * Validation must happen in service layer to match schema constraint
   */
  @Column('text', { array: true })
  wrongAnswers!: string[]

  /**
   * Path to question image (relative or absolute URL)
   * CONSTRAINT: NOT NULL
   */
  @Column('varchar', { length: 512 })
  imagePath!: string

  /**
   * Time limit for answering in seconds
   * If NULL, no time limit (warning: could cause game to hang)
   */
  @Column('smallint', { nullable: true })
  timeLimitSeconds: number | null = null

  /**
   * Base points awarded for correct answer
   * Actual points = base_points * (time_remaining / time_limit)
   * CONSTRAINT: NOT NULL, default 1000
   */
  @Column('smallint', { default: 1000 })
  basePoints!: number

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date

  /**
   * Relationship: rounds that use this question
   */
  @OneToMany('Round', 'question', { onDelete: 'RESTRICT' })
  rounds!: Round[]

  /**
   * Validate that wrong answers array has exactly 3 items
   * Called before insert/update
   */
  @BeforeInsert()
  @BeforeUpdate()
  validateWrongAnswers(): void {
    if (!Array.isArray(this.wrongAnswers) || this.wrongAnswers.length !== 3) {
      throw new Error('Question must have exactly 3 wrong answers')
    }
  }
}
