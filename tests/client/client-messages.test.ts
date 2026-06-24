/**
 * @file client-messages.test.ts
 * @owner client-squad
 */
import { describe, it } from 'node:test'
import * as assert from 'node:assert/strict'
import {
  buildJoinMessage,
  buildAnswerMessage,
  buildRoundSubmitMessage,
  buildRoundProgressMessage,
} from '../../src/client/hooks/clientMessages.js'
import * as EVENTS from '@brain-wiz/shared/constants/socket-events.constants'
import type { PlayerAvatar, RoundContentPayload } from '@brain-wiz/shared/types/index'
import type { SavedPlayer } from '../../src/client/App.interfaces.js'

const avatar: PlayerAvatar = { bodyColor: '#ff2d2d', faceId: 0 }

const roundContent = {
  roundId: 'round-1',
  type: 'sliding-puzzle',
} as RoundContentPayload

function parse(message: string): { event: string; data: Record<string, unknown> } {
  return JSON.parse(message) as { event: string; data: Record<string, unknown> }
}

describe('buildJoinMessage', () => {
  it('builds a fresh join without reconnect credentials', () => {
    const { event, data } = parse(buildJoinMessage('Alice', 'ABCD', avatar, null))
    assert.equal(event, EVENTS.PLAYER_JOIN)
    assert.deepEqual(data, { roomCode: 'ABCD', playerName: 'Alice', playerAvatar: avatar })
    assert.equal('playerId' in data, false)
    assert.equal('playerToken' in data, false)
  })

  it('includes playerId and reconnect token when credentials are present', () => {
    const creds: SavedPlayer = {
      roomCode: 'ABCD',
      playerName: 'Alice',
      playerId: 'player-1',
      reconnectToken: 'tok-123',
      playerAvatar: avatar,
    }
    const { event, data } = parse(buildJoinMessage('Alice', 'ABCD', avatar, creds))
    assert.equal(event, EVENTS.PLAYER_JOIN)
    assert.equal(data['playerId'], 'player-1')
    assert.equal(data['playerToken'], 'tok-123')
  })
})

describe('buildAnswerMessage', () => {
  it('wraps the answer id and timestamp', () => {
    const { event, data } = parse(buildAnswerMessage('answer-9', 1000))
    assert.equal(event, EVENTS.ANSWER_SUBMIT)
    assert.deepEqual(data, { answerId: 'answer-9', timestamp: 1000 })
  })

  it('defaults the timestamp to a number', () => {
    const { data } = parse(buildAnswerMessage('answer-9'))
    assert.equal(typeof data['timestamp'], 'number')
  })
})

describe('buildRoundSubmitMessage / buildRoundProgressMessage', () => {
  it('carries the round id, type, submission and timestamp on submit', () => {
    const { event, data } = parse(buildRoundSubmitMessage(roundContent, { moved: true }, 2000))
    assert.equal(event, EVENTS.ROUND_SUBMIT)
    assert.deepEqual(data, {
      roundId: 'round-1',
      type: 'sliding-puzzle',
      submission: { moved: true },
      timestamp: 2000,
    })
  })

  it('uses the ROUND_PROGRESS event for progress updates', () => {
    const { event, data } = parse(buildRoundProgressMessage(roundContent, { moved: true }, 2000))
    assert.equal(event, EVENTS.ROUND_PROGRESS)
    assert.equal(data['roundId'], 'round-1')
  })
})
