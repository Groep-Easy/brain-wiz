/**
 * @file src/server/entities/room.entity.ts
 * @description Game room/session entity
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
import { GameModeEnum, RoomStatusEnum, QuestionThemeEnum, CodingLanguageEnum } from './enums'
import type { Client } from './client.entity'
import type { Round } from './round.entity'

/**
 * Room entity - represents a multiplayer game session
 * Hosts coordinate which room players join via join code
 */
@Entity('rooms')
@Index('idx_rooms_join_code_active', ['joinCode'], {
  where: "(status IN ('lobby', 'active'))",
})
export class Room {
  @PrimaryGeneratedColumn('uuid')
  public id!: string

  /**
   * Join code for players to enter room (e.g., "ABCD1234")
   * Must be unique among active/lobby rooms only (via partial index)
   * Finished/abandoned rooms can be re-used
   * CONSTRAINT: NOT NULL
   */
  @Column('varchar', { length: 16 })
  public joinCode!: string

  /**
   * QR code payload (usually the full join URL)
   * Used by host display to show QR for players to scan
   * CONSTRAINT: NOT NULL
   */
  @Column('varchar', { length: 512, default: '' })
  public qrCodePayload!: string

  /**
   * QR code as SVG string
   * Generated when room is created
   * Stored so the host display can render it without regeneration
   */
  @Column('text', { default: '' })
  public qrCodeSvg!: string

  /**
   * Contains all the questions that are already asked
   */

  @Column('uuid', { array: true, default: '{}' })
  public usedQuestionsIds!: string[]

  /**
   * Current status of the room
   * CONSTRAINT: NOT NULL, default 'lobby'
   */
  @Column('enum', { enum: RoomStatusEnum, default: RoomStatusEnum.LOBBY })
  public status!: RoomStatusEnum

  /**
   * WebSocket ID of the host connection
   * Used to send events to host display
   * Can be NULL if host disconnected
   */
  @Column('varchar', { length: 128, nullable: true })
  public hostSocketId: string | null = null

  /**
   * Game modes selected for this session
   * Array of one or more: 'questions', 'coding', 'puzzles'
   * CONSTRAINT: NOT NULL, min length 1
   */
  @Column('enum', { enum: GameModeEnum, array: true })
  public selectedGameModes!: GameModeEnum[]

  /**
   * Question themes to filter content
   * Empty array = all themes allowed
   */
  @Column('enum', {
    enum: QuestionThemeEnum,
    array: true,
  })
  public selectedThemes!: QuestionThemeEnum[]

  /**
   * Coding languages to filter challenges
   * Empty array = all languages allowed
   */
  @Column('enum', {
    enum: CodingLanguageEnum,
    array: true,
  })
  public selectedLanguages!: CodingLanguageEnum[]

  /**
   * Total rounds to play in this session
   * CONSTRAINT: NOT NULL, default 10, must be > 0
   */
  @Column('smallint', { default: 10 })
  public totalRounds!: number

  /**
   * Default time limit for rounds (seconds)
   * Can be overridden per round
   * CONSTRAINT: NOT NULL, default 20, must be > 0
   */
  @Column('smallint', { default: 20 })
  public defaultTimeLimitSeconds!: number

  /**
   * Current round index (0-based)
   * Used to track progress through the session
   * CONSTRAINT: NOT NULL, default 0
   */
  @Column('smallint', { default: 0 })
  public currentRoundIndex!: number

  /**
   * Timestamp when game actually started (not when room was created)
   * NULL until room status becomes 'active'
   */
  @Column('timestamptz', { nullable: true })
  public startedAt: Date | null = null

  /**
   * Timestamp when game finished
   * Set when status changes to 'finished' or 'abandoned'
   */
  @Column('timestamptz', { nullable: true })
  public finishedAt: Date | null = null

  @CreateDateColumn()
  public createdAt!: Date

  @UpdateDateColumn()
  public updatedAt!: Date

  /**
   * Relationships
   */
  @OneToMany('Client', 'room', { onDelete: 'CASCADE' })
  public clients!: Client[]

  @OneToMany('Round', 'room', { onDelete: 'CASCADE' })
  public rounds!: Round[]

  /**
   * Validate constraints before insert
   */
  @BeforeInsert()
  @BeforeUpdate()
  public validateRoom(): void {
    if (this.totalRounds <= 0) {
      throw new Error('totalRounds must be greater than 0')
    }

    if (this.defaultTimeLimitSeconds <= 0) {
      throw new Error('defaultTimeLimitSeconds must be greater than 0')
    }

    if (!this.selectedGameModes || this.selectedGameModes.length === 0) {
      throw new Error('At least one game mode must be selected')
    }

    if (this.currentRoundIndex < 0 || this.currentRoundIndex > this.totalRounds) {
      throw new Error('currentRoundIndex must be between 0 and totalRounds')
    }

    // Validate status transitions
    if (this.status === RoomStatusEnum.ACTIVE && !this.startedAt) {
      throw new Error('startedAt must be set when status is ACTIVE')
    }

    if (
      (this.status === RoomStatusEnum.FINISHED || this.status === RoomStatusEnum.ABANDONED) &&
      !this.finishedAt
    ) {
      throw new Error('finishedAt must be set when status is FINISHED or ABANDONED')
    }
  }
}
