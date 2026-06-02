/**
 * @file room-manager.test.js
 * @owner server-squad
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { RoomManager } from '../../src/server/core/room-manager.js'
import { ROOM } from '../../src/shared/constants/game-config.js'

describe('RoomManager', () => {
  it('creates a room and returns a valid code', () => {
    const mgr = new RoomManager()
    const code = mgr.createRoom()
    assert.equal(code.length, ROOM.CODE_LENGTH)
  })
  it('retrieves created room in lobby phase', () => {
    const mgr = new RoomManager()
    const code = mgr.createRoom()
    assert.equal(mgr.getRoom(code).phase, 'lobby')
  })
  it('adds player successfully', () => {
    const mgr = new RoomManager()
    const code = mgr.createRoom()
    assert.equal(mgr.addPlayer(code, { id: 's1', name: 'Alice', connected: true, score: 0 }), true)
  })
  it('rejects player when room full', () => {
    const mgr = new RoomManager()
    const code = mgr.createRoom()
    for (let i = 0; i < ROOM.MAX_PLAYERS; i++) {
      mgr.addPlayer(code, { id: `s${i}`, name: `P${i}`, connected: true, score: 0 })
    }
    assert.equal(mgr.addPlayer(code, { id: 'x', name: 'X', connected: true, score: 0 }), false)
  })
  it('removes player by id', () => {
    const mgr = new RoomManager()
    const code = mgr.createRoom()
    mgr.addPlayer(code, { id: 'target', name: 'Bob', connected: true, score: 0 })
    mgr.removePlayer('target')
    assert.equal(mgr.getRoom(code).players.length, 0)
  })
})
