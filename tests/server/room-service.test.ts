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
import { ROOM } from '@brain-wiz/config/game.config'

interface FakeRoomRepo {
  repo: Repository<Room>
  saved: Room[]
}

interface FakeRoomQueryBuilder {
  where(condition: string, params: Record<string, unknown>): FakeRoomQueryBuilder
  andWhere(condition: string, params: Record<string, unknown>): FakeRoomQueryBuilder
  getOne(): Promise<Room | null>
}

const makeRoomId = (value: number): string =>
  `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`

/**
 * @param existsFor codes for which the fake query builder should report an existing room
 */
function makeFakeRepo(existsFor: string[] = []): FakeRoomRepo {
  const saved: Room[] = []
  const exists = new Set(existsFor)

  const repo = {
    create: (partial: Partial<Room>): Room => Object.assign(new Room(), partial),

    save: async (room: Room): Promise<Room> => {
      if (!room.id) {
        room.id = makeRoomId(saved.length + 1)
      }
      saved.push(room)
      return room
    },

    createQueryBuilder: (): FakeRoomQueryBuilder => {
      let joinCodeFilter: string | undefined
      let idFilter: string | undefined
      let statusesFilter: RoomStatusEnum[] | undefined

      const queryBuilder: FakeRoomQueryBuilder = {
        where: (condition: string, params: Record<string, unknown>): FakeRoomQueryBuilder => {
          if (condition.includes('room.joinCode')) {
            joinCodeFilter = params['joinCode'] as string
          }

          if (condition.includes('room.id')) {
            idFilter = params['id'] as string
          }

          return queryBuilder
        },

        andWhere: (_condition: string, params: Record<string, unknown>): FakeRoomQueryBuilder => {
          statusesFilter = params['statuses'] as RoomStatusEnum[]
          return queryBuilder
        },

        getOne: async (): Promise<Room | null> => {
          if (joinCodeFilter !== undefined && exists.has(joinCodeFilter)) {
            return Object.assign(new Room(), {
              id: makeRoomId(999999),
              joinCode: joinCodeFilter,
              status: RoomStatusEnum.LOBBY,
            })
          }

          return (
            saved.find((room) => {
              if (joinCodeFilter !== undefined && room.joinCode !== joinCodeFilter) {
                return false
              }

              if (idFilter !== undefined && room.id !== idFilter) {
                return false
              }

              if (statusesFilter !== undefined && !statusesFilter.includes(room.status)) {
                return false
              }

              return true
            }) ?? null
          )
        },
      }

      return queryBuilder
    },
  } as unknown as Repository<Room>

  return { repo, saved }
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
    const { repo } = makeFakeRepo()
    const service = new RoomService(repo)
    // Patch createQueryBuilder to collide once, then succeed.
    let calls = 0
    ;(repo as unknown as { createQueryBuilder: () => FakeRoomQueryBuilder }).createQueryBuilder =
      (): FakeRoomQueryBuilder => {
        const queryBuilder: FakeRoomQueryBuilder = {
          where: (): FakeRoomQueryBuilder => queryBuilder,
          andWhere: (): FakeRoomQueryBuilder => queryBuilder,
          getOne: async (): Promise<Room | null> => {
            calls++
            return calls === 1
              ? Object.assign(new Room(), { id: makeRoomId(999999), status: RoomStatusEnum.LOBBY })
              : null
          },
        }

        return queryBuilder
      }

    const room = await service.createRoom()

    assert.ok(room.joinCode.length === ROOM.CODE_LENGTH)
    assert.equal(calls, 2)
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
