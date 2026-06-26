/**
 * @file answer.service.ts
 * @description Owns the in-memory open answer window for each room. Validates
 * ANSWER_SUBMIT, persists one ClientAnswer per client per round (storing the
 * chosen answerId), ACKs the socket, and signals the engine (via the bus) once
 * every currently-connected client has answered.
 */
import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Repository } from 'typeorm'
import { ClientAnswer } from '../../entities/client-answer.entity'
import { ConnectionRegistry } from '../lobby/connection-registry'
import { RoomBroadcaster } from '../lobby/room-broadcaster'
import { GameEventBus } from './game-event-bus'
import type { ClientSocket } from '../lobby/lobby.types'
import type {
  AnswerAckPayload,
  AnswerSubmitPayload,
  RoundProgressPayload,
  RoundSubmitPayload,
} from '@brain-wiz/shared/types/index'
import type { OpenWindow, PersistSubmissionInput, RoundProgressSnapshot } from './game.types'
import * as EVENTS from '@brain-wiz/shared/constants/socket-events.constants'
import { MinigameRegistry } from './minigames/minigame-registry'

/** Postgres unique_violation SQLSTATE — raised when the (clientId, roundId)
 *  unique index rejects a duplicate answer row. */
const PG_UNIQUE_VIOLATION = '23505'

@Injectable()
export class AnswerService {
  private readonly logger = new Logger(AnswerService.name)
  private readonly windows = new Map<string, OpenWindow>()

  public constructor(
    private readonly bus: GameEventBus,
    private readonly registry: ConnectionRegistry,
    private readonly broadcaster: RoomBroadcaster,
    @InjectRepository(ClientAnswer) private readonly answers: Repository<ClientAnswer>,
    private readonly minigames?: MinigameRegistry
  ) {
    this.bus.on('ROUND_WINDOW_OPENED').subscribe((e) => {
      this.windows.set(e.roomId, {
        roundId: e.roundId,
        roundType: e.roundType,
        scoringMode: e.scoringMode,
        shownAt: e.shownAt,
        options: new Map((e.options ?? []).map((o) => [o.id, o])),
        ...(e.privateState !== undefined ? { privateState: e.privateState } : {}),
        ...(e.scoringConfig !== undefined ? { scoringConfig: e.scoringConfig } : {}),
        submitted: new Map<string, string>(),
        progress: new Map<string, RoundProgressSnapshot>(),
      })
    })
    this.bus.on('ROUND_WINDOW_FINALIZE_REQUESTED').subscribe((e) => {
      void this.finalizeWindow(e.roomId, e.roundId)
    })
    this.bus.on('ROUND_WINDOW_CLOSED').subscribe((e) => {
      this.windows.delete(e.roomId)
    })
    this.bus.on('ROUND_WINDOW_ABORTED').subscribe((e) => {
      this.windows.delete(e.roomId)
    })
  }

  public getClientSubmission(roomId: string, clientId: string): string | undefined {
    const window = this.windows.get(roomId)
    if (!window || !window.submitted.has(clientId)) {
      return undefined
    }
    return window.submitted.get(clientId)
  }

  public async submit(socket: ClientSocket, payload: AnswerSubmitPayload): Promise<void> {
    const membership = this.registry.lookup(socket)
    if (!membership || membership.role !== 'client') {
      return
    }
    const { roomId, clientId } = membership

    const window = this.windows.get(roomId)
    if (!window) {
      this.ack(socket, false, 'window-closed')
      return
    }
    if (window.scoringMode !== 'quiz') {
      this.ack(socket, false, 'invalid-answer')
      return
    }
    const option = window.options.get(payload.answerId)
    if (!option) {
      this.ack(socket, false, 'invalid-answer')
      return
    }
    if (window.submitted.has(clientId)) {
      this.ack(socket, false, 'already-answered')
      return
    }

    await this.persistSubmission({
      socket,
      roomId,
      clientId,
      window,
      answerValue: payload.answerId,
    })
  }

  public async submitRound(socket: ClientSocket, payload: RoundSubmitPayload): Promise<void> {
    const membership = this.registry.lookup(socket)
    if (!membership || membership.role !== 'client') {
      return
    }
    const { roomId, clientId } = membership

    const window = this.windows.get(roomId)
    if (!this.validateRoundSubmission(socket, payload, clientId, window)) {
      return
    }

    await this.persistSubmission({
      socket,
      roomId,
      clientId,
      window,
      answerValue: JSON.stringify(payload.submission),
    })
  }

  /** Validates a RoundSubmit against the open window, ACKing on rejection.
   *  Narrows `window` to a defined OpenWindow when it returns true. */
  private validateRoundSubmission(
    socket: ClientSocket,
    payload: RoundSubmitPayload,
    clientId: string,
    window: OpenWindow | undefined
  ): window is OpenWindow {
    if (!window) {
      this.ack(socket, false, 'window-closed')
      return false
    }
    if (
      window.scoringMode !== 'minigame' ||
      payload.roundId !== window.roundId ||
      payload.type !== window.roundType
    ) {
      this.ack(socket, false, 'invalid-answer')
      return false
    }
    const adapter = this.minigames?.get(payload.type)
    const isValid = adapter !== undefined && adapter.validateSubmission(payload.submission)
    if (payload.type === 'bonk-air') {
      this.logger.log(
        `[bonk-air] submitRound client=${clientId} valid=${isValid} alreadySubmitted=${window.submitted.has(clientId)}`
      )
    }
    if (!isValid) {
      this.ack(socket, false, 'invalid-answer')
      return false
    }
    if (window.submitted.has(clientId)) {
      this.ack(socket, false, 'already-answered')
      return false
    }
    return true
  }

  public updateRoundProgress(socket: ClientSocket, payload: RoundProgressPayload): void {
    const membership = this.registry.lookup(socket)
    if (!membership || membership.role !== 'client') {
      return
    }
    const { roomId, clientId } = membership

    const window = this.windows.get(roomId)
    if (!this.canAcceptRoundProgress(payload, clientId, window)) {
      return
    }

    const adapter = this.minigames?.get(payload.type)
    if (!adapter || !adapter.validateSubmission(payload.submission)) {
      return
    }

    window.progress.set(clientId, {
      answerValue: JSON.stringify(payload.submission),
      timeToAnswerMs: Date.now() - window.shownAt,
    })

    this.emitRoundProgressFeedback(socket, payload, window, adapter)
  }

  /** True when the open window can accept progress for this payload/client.
   *  Narrows `window` to a defined OpenWindow when it returns true. */
  private canAcceptRoundProgress(
    payload: RoundProgressPayload,
    clientId: string,
    window: OpenWindow | undefined
  ): window is OpenWindow {
    return (
      window !== undefined &&
      window.scoringMode === 'minigame' &&
      payload.roundId === window.roundId &&
      payload.type === window.roundType &&
      !window.submitted.has(clientId)
    )
  }

  private emitRoundProgressFeedback(
    socket: ClientSocket,
    payload: RoundProgressPayload,
    window: OpenWindow,
    adapter: NonNullable<ReturnType<MinigameRegistry['get']>>
  ): void {
    if (adapter.getProgressFeedback && window.privateState) {
      const feedback = adapter.getProgressFeedback(payload.submission, window.privateState)
      if (feedback !== undefined) {
        this.broadcaster.emitToSocket(socket, EVENTS.ROUND_FEEDBACK, {
          roundId: window.roundId,
          type: window.roundType,
          feedback,
        })
      }
    }
  }

  private async persistSubmission(input: PersistSubmissionInput): Promise<void> {
    const { socket, roomId, clientId, window, answerValue } = input
    window.submitted.set(clientId, answerValue)
    const row = this.answers.create({
      clientId,
      roundId: window.roundId,
      answerValue,
      answeredAt: new Date(),
      timeToAnswerMs: Date.now() - window.shownAt,
      isTimeout: false,
    })
    try {
      await this.answers.save(row)
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        this.ack(socket, false, 'already-answered')
        return
      }
      window.submitted.delete(clientId)
      this.logger.error(
        `Failed to persist answer for client ${clientId} round ${window.roundId}: ${String(error)}`
      )
      this.ack(socket, false, 'server-error')
      return
    }
    this.ack(socket, true)

    this.broadcaster.emitToRoom(roomId, EVENTS.ANSWER_COUNT_UPDATE, {
      answered: window.submitted.size,
      total: this.registry.getClientSockets(roomId).length,
    })

    if (this.allConnectedAnswered(roomId, window)) {
      this.bus.publish({ type: 'ALL_PLAYERS_ANSWERED', roomId, roundId: window.roundId })
    }
  }

  private async finalizeWindow(roomId: string, roundId: string): Promise<void> {
    try {
      const window = this.windows.get(roomId)

      if (!window || window.roundId !== roundId) {
        return
      }

      await this.persistProgressSnapshots(window)
      this.windows.delete(roomId)
    } finally {
      this.bus.publish({ type: 'ROUND_WINDOW_FINALIZED', roomId, roundId })
    }
  }

  private async persistProgressSnapshots(window: OpenWindow): Promise<void> {
    if (window.scoringMode !== 'minigame') {
      return
    }

    for (const [clientId, snapshot] of window.progress) {
      if (window.submitted.has(clientId)) {
        continue
      }

      window.submitted.set(clientId, snapshot.answerValue)
      const row = this.answers.create({
        clientId,
        roundId: window.roundId,
        answerValue: snapshot.answerValue,
        answeredAt: new Date(),
        timeToAnswerMs: snapshot.timeToAnswerMs,
        isTimeout: false,
      })

      try {
        await this.answers.save(row)
      } catch (error) {
        if (!this.isUniqueViolation(error)) {
          window.submitted.delete(clientId)
          this.logger.error(
            `Failed to persist progress for client ${clientId} round ${window.roundId}: ${String(
              error
            )}`
          )
        }
      }
    }
  }

  /** True when the error is a Postgres unique-constraint violation. */
  private isUniqueViolation(error: unknown): boolean {
    const candidate = error as { code?: string; driverError?: { code?: string } }
    return (
      candidate?.code === PG_UNIQUE_VIOLATION ||
      candidate?.driverError?.code === PG_UNIQUE_VIOLATION
    )
  }

  private allConnectedAnswered(roomId: string, window: OpenWindow): boolean {
    const connected = this.registry.getClientSockets(roomId).length
    return connected > 0 && window.submitted.size >= connected
  }

  private ack(socket: ClientSocket, accepted: boolean, reason?: AnswerAckPayload['reason']): void {
    const data: AnswerAckPayload = { received: true, accepted, ...(reason ? { reason } : {}) }
    this.broadcaster.emitToSocket(socket, EVENTS.ANSWER_ACK, data)
  }
}
