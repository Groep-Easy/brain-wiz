/**
 * @file round-builder.test.ts
 * @owner server-squad
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Repository } from 'typeorm'
import { RoundBuilder } from '../../src/server/room/game/round-builder.js'
import { NotEnoughQuestionsError } from '../../src/server/room/game/game.errors.js'
import { Question } from '../../src/server/entities/question.entity.js'
import { Round } from '../../src/server/entities/round.entity.js'
import { Room } from '../../src/server/entities/room.entity.js'
import { RoundStatusEnum, ContentTypeEnum } from '../../src/server/entities/enums.js'
import { TIMER } from '../../src/shared/constants/game-config.js'

function fakeQuestionRepo(count: number): Repository<Question> {
  const questions = Array.from({ length: count }, (_, i) =>
    Object.assign(new Question(), { id: `q${i}` })
  )
  return { find: async (): Promise<Question[]> => questions } as unknown as Repository<Question>
}

function fakeRoundRepo(): Repository<Round> {
  let seq = 0
  return {
    create: (p: Partial<Round>): Round => Object.assign(new Round(), p),
    save: async (r: Round): Promise<Round> => {
      if (!r.id) {
        r.id = `round-${seq++}`
      }
      return r
    },
  } as unknown as Repository<Round>
}

function fakeRoomRepo(): Repository<Room> {
  return { save: async (r: Room): Promise<Room> => r } as unknown as Repository<Room>
}

function makeRoom(): Room {
  return Object.assign(new Room(), { id: 'room-1', totalRounds: 4 })
}

describe('RoundBuilder', () => {
  it('builds `count` PENDING quiz rounds with sequential indices and distinct questions', async () => {
    const builder = new RoundBuilder(fakeQuestionRepo(10), fakeRoundRepo(), fakeRoomRepo())
    const room = makeRoom()
    const rounds = await builder.buildRounds(room, 5)

    assert.equal(rounds.length, 5)
    assert.deepEqual(
      rounds.map((r: Round) => r.roundIndex),
      [0, 1, 2, 3, 4]
    )
    assert.ok(rounds.every((r: Round) => r.status === RoundStatusEnum.PENDING))
    assert.ok(rounds.every((r: Round) => r.contentType === ContentTypeEnum.QUESTION))
    assert.ok(rounds.every((r: Round) => r.timeLimitSeconds === TIMER.QUESTION_SECONDS))
    assert.ok(rounds.every((r: Round) => typeof r.question?.id === 'string'))
    const ids = new Set(rounds.map((r: Round) => r.question?.id))
    assert.equal(ids.size, 5, 'questions must be distinct')
    assert.equal(room.totalRounds, 5, 'totalRounds aligned with count')
  })

  it('throws NotEnoughQuestionsError when the pool is too small', async () => {
    const builder = new RoundBuilder(fakeQuestionRepo(3), fakeRoundRepo(), fakeRoomRepo())
    await assert.rejects(async () => builder.buildRounds(makeRoom(), 5), NotEnoughQuestionsError)
  })
})
