/**
 * @file room-service.test.ts
 * @owner server-squad
 * @description Unit tests for RoomService using an in-memory fake repository.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Repository } from 'typeorm'
import { RoomService } from '../../src/server/room/room.service'
import { RoomNotInLobbyError } from '../../src/server/room/room.errors'
import { Room } from '../../src/server/entities/room.entity'
import { RoomStatusEnum } from '../../src/server/entities/enums'
import { ROOM } from '../../src/config/game.config'

interface FakeRoomRepo {
  repo: Repository<Room>
  saved: Room[]
  findOneCalls: () => number
}

/**
 * @param existsFor codes for which findOne should report an existing room
 */
function makeFakeRepo(existsFor: string[] = []): FakeRoomRepo {
  const saved: Room[] = []
  let findOneCalls = 0
  const exists = new Set(existsFor)
  const repo = {
    create: (partial: Partial<Room>): Room => Object.assign(new Room(), partial),
    save: async (room: Room): Promise<Room> => {
      if (!room.id) {
        room.id = `room-${saved.length + 1}`
      }
      saved.push(room)
      return room
    },
    findOne: async (options: { where?: { joinCode?: string } }): Promise<Room | null> => {
      findOneCalls++
      const code = options.where?.joinCode
      if (code !== undefined && exists.has(code)) {
        return Object.assign(new Room(), { id: 'existing', joinCode: code })
      }
      return null
    },
  } as unknown as Repository<Room>
  return { repo, saved, findOneCalls: () => findOneCalls }
}

describe('RoomService.createRoom', () => {
  it('persists a lobby room with a valid join code and at least one game mode', async () => {
    const { repo, saved } = makeFakeRepo()
    const service = new RoomService(repo)

    const room = await service.createRoom()

    assert.equal(saved.length, 1)
    assert.equal(room.status, RoomStatusEnum.LOBBY)
    assert.equal(room.joinCode.length, ROOM.CODE_LENGTH)
    assert.ok(room.selectedGameModes.length >= 1)
    assert.ok(room.qrCodePayload.length > 0)
  })

  it('retries code generation when the first code already exists', async () => {
    // Make the FIRST generated code collide, forcing a second attempt.
    const { repo, findOneCalls } = makeFakeRepo()
    const service = new RoomService(repo)
    // Patch findOne to collide once, then succeed.
    let calls = 0
    ;(repo as unknown as { findOne: () => Promise<Room | null> }).findOne =
      async (): Promise<Room | null> => {
        calls++
        return calls === 1 ? Object.assign(new Room(), { id: 'x' }) : null
      }

    const room = await service.createRoom()

    assert.ok(room.joinCode.length === ROOM.CODE_LENGTH)
    assert.equal(calls, 2)
    void findOneCalls
  })
})

describe('RoomService.findByJoinCode', () => {
  it('returns the repository match', async () => {
    const { repo } = makeFakeRepo(['WXYZ'])
    const service = new RoomService(repo)
    const room = await service.findByJoinCode('WXYZ')
    assert.ok(room)
    assert.equal(room.joinCode, 'WXYZ')
  })

  it('returns null when no room matches', async () => {
    const { repo } = makeFakeRepo()
    const service = new RoomService(repo)
    assert.equal(await service.findByJoinCode('NONE'), null)
  })
})

describe('RoomService.startRoom', () => {
  it('transitions a lobby room to active with a startedAt timestamp', async () => {
    const { repo, saved } = makeFakeRepo()
    const service = new RoomService(repo)
    const room = Object.assign(new Room(), {
      id: 'r1',
      status: RoomStatusEnum.LOBBY,
      startedAt: null,
    })

    const started = await service.startRoom(room)

    assert.equal(started.status, RoomStatusEnum.ACTIVE)
    assert.ok(started.startedAt instanceof Date)
    assert.equal(saved.length, 1)
  })

  it('rejects starting a room that is not in the lobby', async () => {
    const { repo } = makeFakeRepo()
    const service = new RoomService(repo)
    const room = Object.assign(new Room(), { id: 'r1', status: RoomStatusEnum.ACTIVE })
    await assert.rejects(async () => service.startRoom(room), RoomNotInLobbyError)
  })
})

describe('RoomService.finishRoom / setCurrentRound', () => {
  it('setCurrentRound persists the new index', async () => {
    const { repo } = makeFakeRepo()
    const service = new RoomService(repo)
    const room = await service.createRoom()
    const updated = await service.setCurrentRound(room, 3)
    assert.equal(updated.currentRoundIndex, 3)
  })

  it('finishRoom sets status and finishedAt', async () => {
    const { repo } = makeFakeRepo()
    const service = new RoomService(repo)
    const room = await service.createRoom()
    await service.startRoom(room)
    const finished = await service.finishRoom(room, RoomStatusEnum.FINISHED)
    assert.equal(finished.status, RoomStatusEnum.FINISHED)
    assert.ok(finished.finishedAt instanceof Date)
  })
})
