/**
 * @file src/server/entities/round.entity.ts
 * @description Round entity - one piece of content per round
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm'
import { RoundStatusEnum, ContentTypeEnum } from './enums'
import type { RoundType } from '../../shared/types/index'
import type { Room } from './room.entity'
import type { Question } from './question.entity'
import type { CodingChallenge } from './coding-challenge.entity'
import type { Puzzle } from './puzzle.entity'
import type { ClientAnswer } from './client-answer.entity'

/**
 * Round entity - represents one content item (question/challenge/puzzle) in a game
 *
 * CRITICAL CONSTRAINT: Exactly one of questionId, codingChallengeId, or puzzleId must be set
 * This is enforced by:
 * 1. Database CHECK constraint (in migration)
 * 2. Entity validation before insert/update
 * 3. Service layer validation
 *
 * This one-to-many relationship prevents N+1 queries and ensures data integrity.
 */
@Entity('rounds')
@Index('idx_rounds_index_unique_per_room', ['roomId', 'roundIndex'], { unique: true })
@Index('idx_rounds_no_repeat_question', ['roomId', 'questionId'], {
  where: '"questionId" IS NOT NULL',
  unique: true,
})
@Index('idx_rounds_no_repeat_coding', ['roomId', 'codingChallengeId'], {
  where: '"codingChallengeId" IS NOT NULL',
  unique: true,
})
@Index('idx_rounds_no_repeat_puzzle', ['roomId', 'puzzleId'], {
  where: '"puzzleId" IS NOT NULL',
  unique: true,
})
export class Round {
  @PrimaryGeneratedColumn('uuid')
  public id!: string

  /**
   * Room this round belongs to
   * CONSTRAINT: NOT NULL, Foreign Key ON DELETE CASCADE
   */
  @ManyToOne('Room', 'rounds', { onDelete: 'CASCADE', eager: false })
  public room!: Room

  /**
   * Room ID (denormalized)
   */
  @Column('uuid')
  public roomId!: string

  /**
   * Round number within this room (0-based)
   * CONSTRAINT: NOT NULL, UNIQUE with roomId
   * Used to order rounds in a room
   */
  @Column('smallint')
  public roundIndex!: number

  /**
   * Current status of this round
   * CONSTRAINT: NOT NULL, default 'pending'
   */
  @Column('enum', { enum: RoundStatusEnum, default: RoundStatusEnum.PENDING })
  public status!: RoundStatusEnum

  /**
   * Type of content in this round
   * CONSTRAINT: NOT NULL
   * Must match which FK is set (if question_id set, contentType = 'question')
   */
  @Column('enum', { enum: ContentTypeEnum })
  public contentType!: ContentTypeEnum

  /**
   * Gameplay type used by the live engine. `quiz` maps to question-backed
   * rounds; procedural minigames use `contentType = puzzle` plus state below.
   */
  @Column('varchar', { length: 64, default: 'quiz' })
  public gameType: RoundType = 'quiz'

  /** Server-created seed for a single procedural game instance. */
  @Column('varchar', { length: 128, nullable: true })
  public seed: string | null = null

  /** Public procedural setup sent to every player in the room. */
  @Column('jsonb', { nullable: true })
  public publicState: Record<string, unknown> | null = null

  /** Hidden solution/state used only by the server for validation/scoring. */
  @Column('jsonb', { nullable: true })
  public privateState: Record<string, unknown> | null = null

  /** Server-owned point rules for this generated round. */
  @Column('jsonb', { nullable: true })
  public scoringConfig: Record<string, unknown> | null = null

  /**
   * Time limit for answering this round (seconds)
   * Can differ from room's default
   * CONSTRAINT: NOT NULL
   */
  @Column('smallint')
  public timeLimitSeconds!: number

  /**
   * When round started (opened for answers)
   */
  @Column('timestamptz', { nullable: true })
  public startedAt: Date | null = null

  /**
   * When round finished (answers locked)
   */
  @Column('timestamptz', { nullable: true })
  public finishedAt: Date | null = null

  /**
   * CRITICAL: One of these three must be set, others must be NULL
   * Database CHECK constraint enforces exactly one is non-null
   */

  /**
   * Question ID if contentType = 'question'
   * CONSTRAINT: Foreign Key to questions(id) ON DELETE RESTRICT
   */
  @ManyToOne('Question', 'rounds', { onDelete: 'RESTRICT', eager: false })
  public question: Question | null = null

  @Column('uuid', { nullable: true })
  public questionId: string | null = null

  /**
   * Coding challenge ID if contentType = 'coding_challenge'
   * CONSTRAINT: Foreign Key to coding_challenges(id) ON DELETE RESTRICT
   */
  @ManyToOne('CodingChallenge', 'rounds', { onDelete: 'RESTRICT', eager: false })
  public codingChallenge: CodingChallenge | null = null

  @Column('uuid', { nullable: true })
  public codingChallengeId: string | null = null

  /**
   * Puzzle ID if contentType = 'puzzle'
   * CONSTRAINT: Foreign Key to puzzles(id) ON DELETE RESTRICT
   */
  @ManyToOne('Puzzle', 'rounds', { onDelete: 'RESTRICT', eager: false })
  public puzzle: Puzzle | null = null

  @Column('uuid', { nullable: true })
  public puzzleId: string | null = null

  @CreateDateColumn()
  public createdAt!: Date

  @UpdateDateColumn()
  public updatedAt!: Date

  /**
   * Relationship: all answers submitted for this round
   */
  @OneToMany('ClientAnswer', 'round', { onDelete: 'CASCADE' })
  public clientAnswers!: ClientAnswer[]

  /**
   * Validate before insert/update
   * Ensures exactly one content FK is set
   * This duplicates the database CHECK constraint for early validation
   */
  @BeforeInsert()
  @BeforeUpdate()
  public validateRound(): void {
    const contentCount = [this.questionId, this.codingChallengeId, this.puzzleId].filter(
      (id) => id !== null && id !== undefined
    ).length

    const isProceduralMinigame = this.gameType !== 'quiz'

    if (isProceduralMinigame) {
      if (this.contentType !== ContentTypeEnum.PUZZLE) {
        throw new Error('procedural minigame rounds must use contentType PUZZLE')
      }
      if (!this.seed || !this.publicState || !this.privateState || !this.scoringConfig) {
        throw new Error('procedural minigame rounds require seed and generated state')
      }
    } else if (contentCount !== 1) {
      throw new Error(
        `Round must have exactly one content item. ` +
          `Found: question=${this.questionId ? '✓' : '✗'}, ` +
          `coding=${this.codingChallengeId ? '✓' : '✗'}, ` +
          `puzzle=${this.puzzleId ? '✓' : '✗'}`
      )
    }

    // Validate contentType matches the set FK
    if (this.contentType === ContentTypeEnum.QUESTION && !this.questionId) {
      throw new Error('contentType is QUESTION but questionId is null')
    }
    if (this.contentType === ContentTypeEnum.CODING_CHALLENGE && !this.codingChallengeId) {
      throw new Error('contentType is CODING_CHALLENGE but codingChallengeId is null')
    }
    if (!isProceduralMinigame && this.contentType === ContentTypeEnum.PUZZLE && !this.puzzleId) {
      throw new Error('contentType is PUZZLE but puzzleId is null')
    }

    if (this.timeLimitSeconds <= 0) {
      throw new Error('timeLimitSeconds must be greater than 0')
    }

    if (this.roundIndex < 0) {
      throw new Error('roundIndex cannot be negative')
    }

    // Validate status transitions
    if (this.status === RoundStatusEnum.ACTIVE && !this.startedAt) {
      throw new Error('startedAt must be set when status is ACTIVE')
    }

    if (this.status === RoundStatusEnum.FINISHED && !this.finishedAt) {
      throw new Error('finishedAt must be set when status is FINISHED')
    }
  }

  /**
   * Helper method to get the content entity (question, challenge, or puzzle)
   * Useful for services that need the actual content
   */
  public getContent(): Question | CodingChallenge | Puzzle | null {
    return this.question || this.codingChallenge || this.puzzle || null
  }
}
