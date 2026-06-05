/**
 * @file src/server/entities/client-answer.entity.ts
 * @description Client answer submission entity - full answer history
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm'
import type { Client } from './client.entity'
import type { Round } from './round.entity'

/**
 * ClientAnswer entity - records one player's answer to one round
 *
 * IMPORTANT: One submission per client per round (enforced by unique constraint)
 * This prevents duplicate answers if player submits multiple times
 */
@Entity('client_answers')
@Index('idx_client_answers_round', ['roundId'])
@Index('idx_client_answers_answered', ['answeredAt'])
@Index('idx_client_answers_unique_submission', ['clientId', 'roundId'], { unique: true })
export class ClientAnswer {
  @PrimaryGeneratedColumn('uuid')
  public id!: string

  /**
   * Client who submitted this answer
   * CONSTRAINT: NOT NULL, Foreign Key to clients(id) ON DELETE CASCADE
   */
  @ManyToOne('Client', 'answers', { onDelete: 'CASCADE', eager: false })
  public client!: Client

  @Column('uuid')
  public clientId!: string

  /**
   * Round this answer is for
   * CONSTRAINT: NOT NULL, Foreign Key to rounds(id) ON DELETE CASCADE
   */
  @ManyToOne('Round', 'clientAnswers', { onDelete: 'CASCADE', eager: false })
  public round!: Round

  @Column('uuid')
  public roundId!: string

  /**
   * The answer value as string
   * Can be:
   * - Multiple choice: option letter or full text
   * - Coding: code snippet
   * - Puzzle: structured answer (JSON encoded if needed)
   * CONSTRAINT: NOT NULL
   */
  @Column('text')
  public answerValue!: string

  /**
   * Whether the answer was correct
   * NULL until scoring is complete
   */
  @Column('boolean', { nullable: true })
  public isCorrect: boolean | null = null

  /**
   * Points awarded for this answer
   * Calculated during scoring phase
   * NULL until scoring is complete
   * 0 = correct answer but no points (e.g., too slow)
   */
  @Column('int', { nullable: true })
  public pointsAwarded: number | null = null

  /**
   * When client submitted this answer
   * CONSTRAINT: NOT NULL
   */
  @Column('timestamptz')
  public answeredAt!: Date

  /**
   * How long client took to answer (milliseconds from round start to submission)
   * Used for scoring calculations (faster answers worth more points)
   */
  @Column('int', { nullable: true })
  public timeToAnswerMs: number | null = null

  /**
   * Whether the client ran out of time (no answer submitted)
   * isCorrect should be false if this is true
   * CONSTRAINT: NOT NULL, default false
   */
  @Column('boolean', { default: false })
  public isTimeout!: boolean

  @CreateDateColumn()
  public createdAt!: Date

  @UpdateDateColumn()
  public updatedAt!: Date

  /**
   * Validate before insert/update
   */
  @BeforeInsert()
  @BeforeUpdate()
  public validateAnswer(): void {
    if (!this.answerValue || this.answerValue.trim().length === 0) {
      throw new Error('answerValue cannot be empty')
    }

    if (this.isTimeout && (this.answerValue.length > 0 || this.answeredAt)) {
      // isTimeout should indicate NO answer was submitted
      // If you have an answer value, it's not a timeout
      throw new Error('isTimeout cannot be true if answerValue is provided')
    }

    if (this.pointsAwarded !== null && this.pointsAwarded < 0) {
      throw new Error('pointsAwarded cannot be negative')
    }

    if (this.timeToAnswerMs !== null && this.timeToAnswerMs < 0) {
      throw new Error('timeToAnswerMs cannot be negative')
    }

    // If scoring is complete, both isCorrect and pointsAwarded should be set
    if (
      (this.isCorrect !== null && this.pointsAwarded === null) ||
      (this.isCorrect === null && this.pointsAwarded !== null)
    ) {
      // Optionally allow partial state, but log warning
      // eslint-disable-next-line no-console
      console.warn(
        `ClientAnswer ${this.id}: partial scoring state - ` +
          `isCorrect=${this.isCorrect}, pointsAwarded=${this.pointsAwarded}`
      )
    }
  }
}
