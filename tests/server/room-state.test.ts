/**
 * @file room-state.test.ts
 * @owner server-squad
 * @description Unit tests for the DB-row -> wire RoomState mapper.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { toRoomState, roomStatusToPhase } from '../../src/server/room/room.helpers.js'
import { RoomStatusEnum } from '../../src/server/entities/enums.js'

describe('roomStatusToPhase', () => {
  it('maps lobby to the lobby phase', () => {
    assert.equal(roomStatusToPhase(RoomStatusEnum.LOBBY), 'lobby')
  })
  it('maps active to the round-intro phase (game started, before first round)', () => {
    assert.equal(roomStatusToPhase(RoomStatusEnum.ACTIVE), 'round-intro')
  })
  it('maps finished to the game-over phase', () => {
    assert.equal(roomStatusToPhase(RoomStatusEnum.FINISHED), 'game-over')
  })
  it('maps abandoned to the game-over phase', () => {
    assert.equal(roomStatusToPhase(RoomStatusEnum.ABANDONED), 'game-over')
  })
})

describe('toRoomState', () => {
  const room = { joinCode: 'ABCD', status: RoomStatusEnum.LOBBY, currentRoundIndex: 0 }

  it('uses the room join code and round index', () => {
    const state = toRoomState(room, [])
    assert.equal(state.code, 'ABCD')
    assert.equal(state.round, 0)
    assert.equal(state.phase, 'lobby')
    assert.deepEqual(state.players, [])
  })

  it('maps client rows to wire players', () => {
    const clients = [
      { id: 'c1', displayName: 'Alice', isConnected: true, totalScore: 10 },
      { id: 'c2', displayName: 'Bob', isConnected: false, totalScore: 0 },
    ]
    const state = toRoomState(room, clients)
    assert.deepEqual(state.players, [
      { id: 'c1', name: 'Alice', connected: true, score: 10 },
      { id: 'c2', name: 'Bob', connected: false, score: 0 },
    ])
  })
})

describe('toRoomState livePhase override', () => {
  const room = { joinCode: 'ABCD', status: RoomStatusEnum.ACTIVE, currentRoundIndex: 2 }

  it('uses the live phase when provided', () => {
    const state = toRoomState(room, [], 'playing')
    assert.equal(state.phase, 'playing')
    assert.equal(state.round, 2)
  })

  it('falls back to the status-derived phase when omitted', () => {
    const state = toRoomState(room, [])
    assert.equal(state.phase, 'round-intro')
  })
})
