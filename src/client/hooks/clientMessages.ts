/**
 * @file clientMessages.ts
 * @description Pure builders for the JSON frames the client sends to the server.
 * No socket or browser access: each returns the string to hand to `socket.send`.
 */
import * as EVENTS from '@brain-wiz/shared/constants/socket-events.constants'
import type { PlayerAvatar, RoundContentPayload } from '@brain-wiz/shared/types/index'
import type { SavedPlayer } from '../App.interfaces'

export function buildJoinMessage(
  name: string,
  code: string,
  playerAvatar: PlayerAvatar,
  creds: SavedPlayer | null
): string {
  return JSON.stringify({
    event: EVENTS.PLAYER_JOIN,
    data: {
      roomCode: code,
      playerName: name,
      playerAvatar,
      ...(creds ? { playerId: creds.playerId, playerToken: creds.reconnectToken } : {}),
    },
  })
}

export function buildAnswerMessage(answerId: string, timestamp = Date.now()): string {
  return JSON.stringify({
    event: EVENTS.ANSWER_SUBMIT,
    data: { answerId, timestamp },
  })
}

export function buildRoundSubmitMessage(
  roundContent: RoundContentPayload,
  submission: unknown,
  timestamp = Date.now()
): string {
  return JSON.stringify({
    event: EVENTS.ROUND_SUBMIT,
    data: {
      roundId: roundContent.roundId,
      type: roundContent.type,
      submission,
      timestamp,
    },
  })
}

export function buildRoundProgressMessage(
  roundContent: RoundContentPayload,
  submission: unknown,
  timestamp = Date.now()
): string {
  return JSON.stringify({
    event: EVENTS.ROUND_PROGRESS,
    data: {
      roundId: roundContent.roundId,
      type: roundContent.type,
      submission,
      timestamp,
    },
  })
}
