/**
 * @file rooms-controller.test.ts
 * @owner server-squad
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common'
import { RoomsController } from '../../src/server/room/lobby/room.controller.js'
import type { LobbyService } from '../../src/server/room/lobby/lobby.service.js'
import { RoomNotFoundError } from '../../src/server/room/room.errors.js'
import {
  InvalidHostTokenError,
  NotEnoughPlayersError,
} from '../../src/server/room/lobby/lobby.errors.js'
import type { RoomState } from '../../src/shared/types/index.js'

const lobbyState: RoomState = { code: 'ABCD', players: [], phase: 'lobby', round: 0 }

function controllerWith(overrides: Partial<LobbyService>): RoomsController {
  return new RoomsController(overrides as LobbyService)
}

describe('RoomsController.createRoom', () => {
  it('returns the join code and host token', async () => {
    const controller = controllerWith({
      createRoom: async () => ({ code: 'ABCD', hostToken: 'tok', roomId: 'room-1' }),
    })
    const result = await controller.createRoom()
    assert.deepEqual(result, { code: 'ABCD', hostToken: 'tok' })
  })
})

describe('RoomsController.getRoom', () => {
  it('returns the room state when it exists', async () => {
    const controller = controllerWith({ getRoomState: async () => lobbyState })
    assert.deepEqual(await controller.getRoom('ABCD'), lobbyState)
  })
  it('throws 404 when the room is unknown', async () => {
    const controller = controllerWith({ getRoomState: async () => null })
    await assert.rejects(async () => controller.getRoom('ZZZZ'), NotFoundException)
  })
})

describe('RoomsController.start', () => {
  it('returns the new state on success', async () => {
    const started: RoomState = { ...lobbyState, phase: 'round-intro' }
    const controller = controllerWith({ startGame: async () => started })
    assert.deepEqual(await controller.start('ABCD', { hostToken: 'tok' }), started)
  })
  it('maps RoomNotFoundError to 404', async () => {
    const controller = controllerWith({
      startGame: async () => {
        throw new RoomNotFoundError()
      },
    })
    await assert.rejects(
      async () => controller.start('ZZZZ', { hostToken: 'tok' }),
      NotFoundException
    )
  })
  it('maps InvalidHostTokenError to 403', async () => {
    const controller = controllerWith({
      startGame: async () => {
        throw new InvalidHostTokenError()
      },
    })
    await assert.rejects(
      async () => controller.start('ABCD', { hostToken: 'bad' }),
      ForbiddenException
    )
  })
  it('maps NotEnoughPlayersError to 409', async () => {
    const controller = controllerWith({
      startGame: async () => {
        throw new NotEnoughPlayersError()
      },
    })
    await assert.rejects(
      async () => controller.start('ABCD', { hostToken: 'tok' }),
      ConflictException
    )
  })
})
