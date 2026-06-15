/**
 * @file src/server/entities/client.entity.ts
 * @description Client/player entity
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
import type { Room } from './room.entity'
import type { ClientAnswer } from './client-answer.entity'
import type { PlayerAvatar } from '../../shared/types/index'

const MAX_DISPLAY_NAME_LENGTH = 64

/**
 * Client entity - represents a player in a game room
 * Each client has exactly one display name per room
 */
@Entity('clients')
@Index('idx_clients_room', ['roomId'])
export class Client {
  @PrimaryGeneratedColumn('uuid')
  public id!: string

  /**
   * Room this client joined
   * CONSTRAINT: NOT NULL, Foreign Key to rooms(id) ON DELETE CASCADE
   */
  @ManyToOne('Room', 'clients', { onDelete: 'CASCADE', eager: false })
  public room!: Room

  /**
   * Room ID (denormalized for query efficiency)
   */
  @Column('uuid')
  public roomId!: string

  /**
   * Display name shown to other players
   * CONSTRAINT: NOT NULL, length 1-64
   * UNIQUE per room (multiple clients can have same name in different rooms)
   */
  @Column('varchar', { length: 64 })
  public displayName!: string

  /**
   * PlayerAvatar shown to other players
   */
  @Column({ type: 'jsonb', nullable: true })
  public playerAvatar!: PlayerAvatar

  /**
   * WebSocket ID for this connection
   * Used to send real-time events to this player
   * Can be NULL if player disconnected
   * May change if player reconnects (new WebSocket session)
   */
  @Column('varchar', { length: 128, nullable: true })
  public socketId: string | null = null

  /**
   * Whether this client is currently connected via WebSocket
   * CONSTRAINT: NOT NULL, default false
   * Transient property - updates when socket connects/disconnects
   */
  @Column('boolean', { default: false })
  public isConnected!: boolean

  /**
   * When this client joined the room
   * CONSTRAINT: NOT NULL
   */
  @Column('timestamptz')
  public joinedAt!: Date

  /**
   * Cumulative score for the game session
   * Calculated from all client_answers in this room
   * CONSTRAINT: NOT NULL, default 0
   */
  @Column('int', { default: 0 })
  public totalScore!: number

  /**
   * Final rank in the room (1st, 2nd, 3rd, etc.)
   * Set when room finishes
   * NULL until game ends
   */
  @Column('smallint', { nullable: true })
  public finalRank: number | null = null

  @CreateDateColumn()
  public createdAt!: Date

  @UpdateDateColumn()
  public updatedAt!: Date

  /**
   * Relationships
   */
  @OneToMany('ClientAnswer', 'client', { onDelete: 'CASCADE' })
  public answers!: ClientAnswer[]
  character: any

  /**
   * Validate before insert/update
   */
  @BeforeInsert()
  @BeforeUpdate()
  public validateClient(): void {
    if (!this.displayName || this.displayName.trim().length === 0) {
      throw new Error('displayName cannot be empty')
    }

    if (this.displayName.length > MAX_DISPLAY_NAME_LENGTH) {
      throw new Error(`displayName cannot exceed ${MAX_DISPLAY_NAME_LENGTH} characters`)
    }

    if (this.totalScore < 0) {
      throw new Error('totalScore cannot be negative')
    }

    if (this.finalRank !== null && this.finalRank <= 0) {
      throw new Error('finalRank must be positive (or null)')
    }
  }
}
