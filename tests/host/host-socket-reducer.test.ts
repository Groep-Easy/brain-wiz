/**
 * @file host-socket-reducer.test.ts
 * @owner host-squad
 */
import { describe, it } from 'node:test'
import * as assert from 'node:assert/strict'
import {
  hostSocketReducer,
  createInitialHostState,
} from '../../src/host/hooks/hostSocketReducer.js'
import type { HostSocketState } from '../../src/host/hooks/hostSocketReducer.interfaces.js'
import * as EVENTS from '@brain-wiz/shared/constants/socket-events.constants'

function base(): HostSocketState {
  return createInitialHostState()
}

function server(state: HostSocketState, event: string, data: unknown): HostSocketState {
  return hostSocketReducer(state, { type: 'serverEvent', event, data })
}

describe('createInitialHostState', () => {
  it('starts disconnected with empty game state', () => {
    const state = base()
    assert.equal(state.status, 'closed')
    assert.equal(state.roomState, null)
    assert.equal(state.answeredCount, 0)
    assert.deepEqual(state.leaderboard, [])
  })
})

describe('hostSocketReducer — lifecycle', () => {
  it('opened clears per-game state but keeps the room', () => {
    const dirty: HostSocketState = {
      ...base(),
      roomState: { phase: 'lobby' } as never,
      question: { id: 'q1' } as never,
      answeredCount: 3,
      leaderboard: [{ id: 'p1' } as never],
    }
    const next = hostSocketReducer(dirty, { type: 'opened' })
    assert.equal(next.status, 'open')
    assert.equal(next.question, null)
    assert.equal(next.answeredCount, 0)
    assert.deepEqual(next.leaderboard, [])
    // the room itself is preserved
    assert.deepEqual(next.roomState, { phase: 'lobby' })
  })

  it('closed resets the room and, on the unauthorized code, sets a fatal error', () => {
    const withRoom: HostSocketState = { ...base(), roomState: { phase: 'lobby' } as never }
    const plain = hostSocketReducer(withRoom, { type: 'closed' })
    assert.equal(plain.status, 'closed')
    assert.equal(plain.roomState, null)
    assert.equal(plain.fatalError, null)

    const rejected = hostSocketReducer(withRoom, { type: 'closed', code: 4004 })
    assert.equal(rejected.fatalError, 'Room not found or token invalid')
  })

  it('unauthorized sets a fatal error', () => {
    assert.equal(
      hostSocketReducer(base(), { type: 'unauthorized' }).fatalError,
      'Room taken or unauthorized'
    )
  })
})

describe('hostSocketReducer — server events', () => {
  it('ROOM_STATE_UPDATE replaces the room and GAME_PHASE_CHANGE patches the phase', () => {
    const withRoom = server(base(), EVENTS.ROOM_STATE_UPDATE, { room: { phase: 'lobby' } })
    assert.deepEqual(withRoom.roomState, { phase: 'lobby' })
    const phased = server(withRoom, EVENTS.GAME_PHASE_CHANGE, { phase: 'round-intro' })
    assert.equal(phased.roomState?.phase, 'round-intro')
    // no-op without a room
    assert.equal(server(base(), EVENTS.GAME_PHASE_CHANGE, { phase: 'round-intro' }).roomState, null)
  })

  it('ROUND_START keeps the round but clears round content/reveal', () => {
    const dirty: HostSocketState = {
      ...base(),
      roundContent: { roundId: 'r0' } as never,
      roundReveal: { roundId: 'r0' } as never,
    }
    const next = server(dirty, EVENTS.ROUND_START, { round: { id: 'r1' } })
    assert.deepEqual(next.round, { id: 'r1' })
    assert.equal(next.roundContent, null)
    assert.equal(next.roundReveal, null)
  })

  it('TIMER_TICK and ANSWER_COUNT_UPDATE update their counters', () => {
    assert.equal(server(base(), EVENTS.TIMER_TICK, { secondsRemaining: 9 }).secondsRemaining, 9)
    const counted = server(base(), EVENTS.ANSWER_COUNT_UPDATE, { answered: 2, total: 5 })
    assert.equal(counted.answeredCount, 2)
    assert.equal(counted.totalPlayers, 5)
  })

  it('QUESTION_SHOW sets the question and resets the answered count, ignoring empty payloads', () => {
    const shown = server({ ...base(), answeredCount: 4 }, EVENTS.QUESTION_SHOW, {
      question: { id: 'q1' },
    })
    assert.deepEqual(shown.question, { id: 'q1' })
    assert.equal(shown.answeredCount, 0)
    assert.deepEqual(server(shown, EVENTS.QUESTION_SHOW, {}).question, { id: 'q1' })
  })

  it('content/reveal/roadmap events store their raw payloads', () => {
    assert.deepEqual(
      server(base(), EVENTS.ROUND_CONTENT_SHOW, { roundId: 'r1', type: 'vault-rush' }).roundContent,
      { roundId: 'r1', type: 'vault-rush' }
    )
    assert.deepEqual(server(base(), EVENTS.QUESTION_REVEAL, { roundId: 'r1' }).reveal, {
      roundId: 'r1',
    })
    assert.deepEqual(server(base(), EVENTS.ROUND_REVEAL, { roundId: 'r1' }).roundReveal, {
      roundId: 'r1',
    })
    assert.deepEqual(server(base(), EVENTS.ROADMAP_UPDATE, { themes: [] }).roadmap, { themes: [] })
  })

  it('LEADERBOARD_SHOW and GAME_OVER ignore falsy payloads', () => {
    assert.deepEqual(server(base(), EVENTS.LEADERBOARD_SHOW, {}).leaderboard, [])
    assert.equal(server(base(), EVENTS.GAME_OVER, {}).finalScores, null)
    const over = server(base(), EVENTS.GAME_OVER, { finalScores: { p1: 10 } })
    assert.deepEqual(over.finalScores, { p1: 10 })
  })
})
