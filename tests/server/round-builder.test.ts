/**
 * @file round-builder.test.ts
 * @owner server-squad
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Repository } from 'typeorm'
import { RoundBuilder } from '../../src/server/room/game/round-builder'
import { NotEnoughQuestionsError } from '../../src/server/room/game/game.errors'
import { Question } from '../../src/server/entities/question.entity'
import { Round } from '../../src/server/entities/round.entity'
import { Room } from '../../src/server/entities/room.entity'
import { RoundStatusEnum, ContentTypeEnum } from '../../src/server/entities/enums'
import { TIMER } from '../../src/shared/constants/game-config'

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

function fakeMinigameRegistry(): unknown {
  return {
    get: (type: string): unknown =>
      type === 'sliding-puzzle' || type === 'balance-scale'
        ? {
            type,
            createRound: (input: { seed: string }): unknown => ({
              type,
              seed: input.seed,
              publicState: { setup: type },
              privateState: { solution: type },
              scoringConfig: { points: 100 },
            }),
          }
        : undefined,
  }
}

function makeRoom(): Room {
  return Object.assign(new Room(), { id: 'room-1', totalRounds: 4 })
}

describe('RoundBuilder', () => {
  it('builds the default mixed sequence with shared procedural round state', async () => {
    const builder = new RoundBuilder(
      fakeQuestionRepo(10),
      fakeRoundRepo(),
      fakeRoomRepo(),
      fakeMinigameRegistry() as never
    )
    const room = makeRoom()
    const rounds = await builder.buildRounds(room, 5)

    assert.equal(rounds.length, 5)
    assert.deepEqual(
      rounds.map((r: Round) => r.roundIndex),
      [0, 1, 2, 3, 4]
    )
    assert.ok(rounds.every((r: Round) => r.status === RoundStatusEnum.PENDING))
    assert.deepEqual(
      rounds.map((r: Round) => r.gameType),
      ['quiz', 'balance-scale', 'sliding-puzzle', 'quiz', 'balance-scale']
    )
    assert.deepEqual(
      rounds.map((r: Round) => r.contentType),
      [
        ContentTypeEnum.QUESTION,
        ContentTypeEnum.PUZZLE,
        ContentTypeEnum.PUZZLE,
        ContentTypeEnum.QUESTION,
        ContentTypeEnum.PUZZLE,
      ]
    )
    assert.ok(rounds.every((r: Round) => r.timeLimitSeconds === TIMER.QUESTION_SECONDS))
    const quizRounds = rounds.filter((r: Round) => r.gameType === 'quiz')
    assert.ok(quizRounds.every((r: Round) => typeof r.question?.id === 'string'))
    const ids = new Set(quizRounds.map((r: Round) => r.question?.id))
    assert.equal(ids.size, 2, 'quiz questions must be distinct')
    const proceduralRounds = rounds.filter((r: Round) => r.gameType !== 'quiz')
    assert.ok(proceduralRounds.every((r: Round) => r.seed))
    assert.ok(proceduralRounds.every((r: Round) => r.publicState))
    assert.ok(proceduralRounds.every((r: Round) => r.privateState))
    assert.ok(proceduralRounds.every((r: Round) => r.scoringConfig))
    assert.equal(room.totalRounds, 5, 'totalRounds aligned with count')
  })

  it('throws NotEnoughQuestionsError when the pool is too small', async () => {
    const builder = new RoundBuilder(
      fakeQuestionRepo(1),
      fakeRoundRepo(),
      fakeRoomRepo(),
      fakeMinigameRegistry() as never
    )
    await assert.rejects(async () => builder.buildRounds(makeRoom(), 5), NotEnoughQuestionsError)
  })
})
