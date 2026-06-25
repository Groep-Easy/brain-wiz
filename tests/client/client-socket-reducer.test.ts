/**
 * @file client-socket-reducer.test.ts
 * @owner client-squad
 */
import { describe, it } from 'node:test'
import * as assert from 'node:assert/strict'
import {
  clientSocketReducer,
  createInitialClientState,
} from '../../src/client/hooks/clientSocketReducer.js'
import type { ClientSocketState } from '../../src/client/hooks/clientSocketReducer.interfaces.js'
import * as EVENTS from '@brain-wiz/shared/constants/socket-events.constants'
import type { PlayerAvatar } from '@brain-wiz/shared/types/index'
import type { SavedPlayer } from '../../src/client/App.interfaces.js'

const avatar: PlayerAvatar = { bodyColor: '#ff2d2d', faceId: 0 }

const savedPlayer: SavedPlayer = {
  roomCode: 'ABCD',
  playerName: 'Alice',
  playerId: 'p1',
  reconnectToken: 'tok',
  playerAvatar: avatar,
}

function base(): ClientSocketState {
  return createInitialClientState(null)
}

function server(state: ClientSocketState, event: string, data: unknown): ClientSocketState {
  return clientSocketReducer(state, { type: 'serverEvent', event, data })
}

describe('createInitialClientState', () => {
  it('is not joining without saved credentials', () => {
    assert.equal(createInitialClientState(null).joining, false)
    assert.equal(createInitialClientState(null).creds, null)
  })

  it('starts joining (auto-reconnect) when credentials are saved', () => {
    const state = createInitialClientState(savedPlayer)
    assert.equal(state.joining, true)
    assert.deepEqual(state.creds, savedPlayer)
  })
})

describe('clientSocketReducer — join lifecycle', () => {
  it('PLAYER_JOIN_ACK marks joined, stores creds, and clears the pending join', () => {
    const pending = clientSocketReducer(base(), {
      type: 'pendingJoinSet',
      pending: { name: 'Bob', code: 'WXYZ', playerAvatar: avatar },
    })
    const next = server(pending, EVENTS.PLAYER_JOIN_ACK, {
      roomCode: 'WXYZ',
      playerId: 'player-7',
      reconnectToken: 'rt-7',
      playerAvatar: avatar,
    })
    assert.equal(next.joined, true)
    assert.equal(next.joining, false)
    assert.equal(next.playerId, 'player-7')
    assert.equal(next.pendingJoin, null)
    // playerName falls back to the pending join's name when no prior creds
    assert.equal(next.creds?.playerName, 'Bob')
    assert.equal(next.creds?.reconnectToken, 'rt-7')
  })

  it('PLAYER_JOIN_REJECTED with "Room not found" sets a fatal error and clears creds', () => {
    const next = server(createInitialClientState(savedPlayer), EVENTS.PLAYER_JOIN_REJECTED, {
      reason: 'Room not found',
    })
    assert.equal(next.fatalError, 'Room not found or game already started')
    assert.equal(next.creds, null)
    assert.equal(next.joining, false)
  })

  it('PLAYER_JOIN_REJECTED with another reason sets a (non-fatal) join error', () => {
    const next = server(base(), EVENTS.PLAYER_JOIN_REJECTED, { reason: 'Display name is taken' })
    assert.equal(next.joinError, 'Display name is taken')
    assert.equal(next.fatalError, null)
  })

  it('PLAYER_KICKED clears identity and room state', () => {
    const joined = server(base(), EVENTS.ROOM_STATE_UPDATE, { room: { phase: 'lobby' } })
    const next = server(joined, EVENTS.PLAYER_KICKED, {})
    assert.equal(next.kicked, true)
    assert.equal(next.creds, null)
    assert.equal(next.playerId, null)
    assert.equal(next.roomState, null)
    assert.equal(next.joinError, 'You were kicked from the lobby')
  })
})

describe('clientSocketReducer — gameplay events', () => {
  it('ROOM_STATE_UPDATE replaces the room and GAME_PHASE_CHANGE patches the phase', () => {
    const withRoom = server(base(), EVENTS.ROOM_STATE_UPDATE, {
      room: { phase: 'lobby', players: [] },
    })
    assert.deepEqual(withRoom.roomState, { phase: 'lobby', players: [] })
    const phased = server(withRoom, EVENTS.GAME_PHASE_CHANGE, { phase: 'round-intro' })
    assert.equal(phased.roomState?.phase, 'round-intro')
  })

  it('GAME_PHASE_CHANGE is a no-op when there is no room yet', () => {
    const next = server(base(), EVENTS.GAME_PHASE_CHANGE, { phase: 'round-intro' })
    assert.equal(next.roomState, null)
  })

  it('ROUND_START keeps the round but resets round content and submission flags', () => {
    const dirty: ClientSocketState = {
      ...base(),
      roundContent: { roundId: 'r0' } as never,
      roundSubmitted: true,
      selectedOptionId: 'c1',
    }
    const next = server(dirty, EVENTS.ROUND_START, { round: { id: 'r1' } })
    assert.deepEqual(next.round, { id: 'r1' })
    assert.equal(next.roundContent, null)
    assert.equal(next.roundSubmitted, false)
    assert.equal(next.selectedOptionId, null)
  })

  it('TIMER_TICK updates the remaining seconds', () => {
    const next = server(base(), EVENTS.TIMER_TICK, { secondsRemaining: 12 })
    assert.equal(next.secondsRemaining, 12)
  })

  it('ROUND_FEEDBACK stores feedback that the next round/question/content clears', () => {
    const fed = server(base(), EVENTS.ROUND_FEEDBACK, {
      roundId: 'r1',
      type: 'wordle',
      feedback: { ok: true },
    })
    assert.deepEqual(fed.roundFeedback, { roundId: 'r1', type: 'wordle', feedback: { ok: true } })
    assert.equal(server(fed, EVENTS.ROUND_START, { round: { id: 'r2' } }).roundFeedback, null)
    assert.equal(server(fed, EVENTS.ROUND_CONTENT_SHOW, { roundId: 'r2' }).roundFeedback, null)
    assert.equal(server(fed, EVENTS.QUESTION_SHOW, { question: { id: 'q1' } }).roundFeedback, null)
  })

  it('QUESTION_SHOW sets the question but ignores an empty payload', () => {
    const shown = server(base(), EVENTS.QUESTION_SHOW, { question: { id: 'q1' } })
    assert.deepEqual(shown.question, { id: 'q1' })
    const ignored = server(shown, EVENTS.QUESTION_SHOW, {})
    assert.deepEqual(ignored.question, { id: 'q1' })
  })

  it('ANSWER_ACK clears the selection on a server error but is a no-op when accepted', () => {
    const selected = clientSocketReducer(base(), { type: 'answerSelected', answerId: 'a1' })
    const cleared = server(selected, EVENTS.ANSWER_ACK, { accepted: false, reason: 'server-error' })
    assert.equal(cleared.selectedAnswerId, null)
    const kept = server(selected, EVENTS.ANSWER_ACK, { accepted: true })
    assert.equal(kept.selectedAnswerId, 'a1')
  })

  it('LEADERBOARD_SHOW and GAME_OVER ignore falsy payloads', () => {
    assert.deepEqual(server(base(), EVENTS.LEADERBOARD_SHOW, {}).leaderboard, [])
    assert.equal(server(base(), EVENTS.GAME_OVER, {}).finalScores, null)
  })
})

describe('clientSocketReducer — local actions', () => {
  it('tracks connection status', () => {
    const opened = clientSocketReducer({ ...base(), reconnectExhausted: true }, { type: 'opened' })
    assert.equal(opened.status, 'open')
    assert.equal(opened.reconnectExhausted, false)
    assert.equal(clientSocketReducer(base(), { type: 'closed' }).status, 'closed')
    assert.equal(
      clientSocketReducer(base(), { type: 'reconnectExhausted' }).reconnectExhausted,
      true
    )
  })

  it('joinStarted clears the join error and marks joining', () => {
    const next = clientSocketReducer({ ...base(), joinError: 'old' }, { type: 'joinStarted' })
    assert.equal(next.joining, true)
    assert.equal(next.joinError, null)
  })

  it('leftRoom resets to a closed, empty state', () => {
    const dirty: ClientSocketState = {
      ...base(),
      joined: true,
      creds: savedPlayer,
      roomState: { phase: 'lobby' } as never,
    }
    const next = clientSocketReducer(dirty, { type: 'leftRoom' })
    assert.equal(next.status, 'closed')
    assert.equal(next.joined, false)
    assert.equal(next.creds, null)
    assert.equal(next.roomState, null)
  })

  it('fatalCleared clears both error fields', () => {
    const dirty: ClientSocketState = { ...base(), fatalError: 'boom', joinError: 'nope' }
    const next = clientSocketReducer(dirty, { type: 'fatalCleared' })
    assert.equal(next.fatalError, null)
    assert.equal(next.joinError, null)
  })
})
