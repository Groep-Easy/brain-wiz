/**
 * @file src/server/entities/coding-challenge.entity.ts
 * @description Coding challenge content entity
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
import { DifficultyEnum, CodingLanguageEnum } from './enums.js'
import type { Round } from './round.entity.js'

/**
 * CodingChallenge entity - represents a programming problem
 * Multiple rooms can use the same challenge across different sessions
 */
@Entity('coding_challenges')
@Index('idx_coding_language_difficulty', ['language', 'difficulty'])
export class CodingChallenge {
  @PrimaryGeneratedColumn('uuid')
  public id!: string

  /**
   * Challenge title/name
   * CONSTRAINT: NOT NULL
   */
  @Column('varchar', { length: 512 })
  public title!: string

  /**
   * Full problem description/prompt
   * Can be very long (instructions, examples, edge cases)
   * CONSTRAINT: NOT NULL
   */
  @Column('text')
  public prompt!: string

  /**
   * Initial code snippet shown to player
   * May be NULL if no starter code provided
   */
  @Column('text', { nullable: true })
  public codeSnippet: string | null = null

  /**
   * Programming language for this challenge
   * CONSTRAINT: NOT NULL
   */
  @Column('enum', { enum: CodingLanguageEnum })
  public language!: CodingLanguageEnum

  /**
   * Difficulty level
   * CONSTRAINT: NOT NULL
   */
  @Column('enum', { enum: DifficultyEnum })
  public difficulty!: DifficultyEnum

  /**
   * Correct solution (usually function name or key part)
   * CONSTRAINT: NOT NULL
   */
  @Column('varchar', { length: 256 })
  public correctAnswer!: string

  /**
   * Array of wrong answer options - exactly 3 required
   * CONSTRAINT: array_length must be 3
   * Validation must happen in service layer
   */
  @Column('text', { array: true })
  public wrongAnswers!: string[]

  /**
   * Explanation of the solution for learning
   */
  @Column('text', { nullable: true })
  public solutionExplanation: string | null = null

  /**
   * Path to challenge image/diagram
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
   * Base points for correct answer
   * CONSTRAINT: NOT NULL, default 1000
   */
  @Column('smallint', { default: 1000 })
  public basePoints!: number

  @CreateDateColumn()
  public createdAt!: Date

  @UpdateDateColumn()
  public updatedAt!: Date

  /**
   * Relationship: rounds that use this challenge
   */
  @OneToMany('Round', 'codingChallenge', { onDelete: 'RESTRICT' })
  public rounds!: Round[]

  /**
   * Validate wrong answers array
   */
  @BeforeInsert()
  @BeforeUpdate()
  public validateWrongAnswers(): void {
    if (!Array.isArray(this.wrongAnswers) || this.wrongAnswers.length !== 3) {
      throw new Error('CodingChallenge must have exactly 3 wrong answers')
    }
  }
}
