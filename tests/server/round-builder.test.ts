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
import { GameBlock } from '../../src/server/entities/game-block.entity'
import {
  RoundStatusEnum,
  ContentTypeEnum,
  BlockKindEnum,
  QuestionThemeEnum,
} from '../../src/server/entities/enums'
import { TIMER } from '../../src/shared/constants/game-config'

function fakeQuestionRepo(count: number): Repository<Question> {
  const questions = Array.from({ length: count }, (_, i) =>
    Object.assign(new Question(), { id: `q${i}`, theme: QuestionThemeEnum.SCIENCE })
  )
  return { find: async (): Promise<Question[]> => questions } as unknown as Repository<Question>
}

/** Questions spread across two themes, `perTheme` each. */
function fakeThemedQuestionRepo(perTheme: number): Repository<Question> {
  const themes = [QuestionThemeEnum.SCIENCE, QuestionThemeEnum.HISTORY]
  const questions = themes.flatMap((theme) =>
    Array.from({ length: perTheme }, (_, i) =>
      Object.assign(new Question(), { id: `${theme}-${i}`, theme })
    )
  )
  return { find: async (): Promise<Question[]> => questions } as unknown as Repository<Question>
}

function fakeBlockRepo(): Repository<GameBlock> {
  const blocks = [
    Object.assign(new GameBlock(), {
      id: 'theme-science',
      kind: BlockKindEnum.THEME,
      theme: QuestionThemeEnum.SCIENCE,
    }),
    Object.assign(new GameBlock(), {
      id: 'theme-history',
      kind: BlockKindEnum.THEME,
      theme: QuestionThemeEnum.HISTORY,
    }),
    Object.assign(new GameBlock(), {
      id: 'mini-balance-scale',
      kind: BlockKindEnum.MINIGAME,
      theme: null,
    }),
  ]
  return { find: async (): Promise<GameBlock[]> => blocks } as unknown as Repository<GameBlock>
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
    const builder = new RoundBuilder(
      fakeQuestionRepo(10),
      fakeRoundRepo(),
      fakeRoomRepo(),
      fakeBlockRepo()
    )
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
    const builder = new RoundBuilder(
      fakeQuestionRepo(3),
      fakeRoundRepo(),
      fakeRoomRepo(),
      fakeBlockRepo()
    )
    await assert.rejects(async () => builder.buildRounds(makeRoom(), 5), NotEnoughQuestionsError)
  })

  it('expands a stored flow: theme blocks become questions, mini-game blocks are skipped', async () => {
    const builder = new RoundBuilder(
      fakeThemedQuestionRepo(5),
      fakeRoundRepo(),
      fakeRoomRepo(),
      fakeBlockRepo()
    )
    const room = Object.assign(new Room(), {
      id: 'room-flow',
      totalRounds: 4,
      gameFlow: [
        { blockId: 'theme-science', questions: 3 },
        { blockId: 'mini-balance-scale' },
        { blockId: 'theme-history', questions: 2 },
      ],
    })
    const rounds = await builder.buildRounds(room, 5)

    // 3 science + 0 minigame + 2 history = 5 rounds, in flow order.
    assert.equal(rounds.length, 5)
    assert.equal(room.totalRounds, 5)
    assert.ok(rounds.every((r: Round) => r.contentType === ContentTypeEnum.QUESTION))
    assert.equal(rounds.filter((r) => r.question?.theme === QuestionThemeEnum.SCIENCE).length, 3)
    assert.equal(rounds.filter((r) => r.question?.theme === QuestionThemeEnum.HISTORY).length, 2)
  })

  it('clamps a theme block to the questions actually available', async () => {
    const builder = new RoundBuilder(
      fakeThemedQuestionRepo(2),
      fakeRoundRepo(),
      fakeRoomRepo(),
      fakeBlockRepo()
    )
    const room = Object.assign(new Room(), {
      id: 'room-clamp',
      totalRounds: 4,
      gameFlow: [{ blockId: 'theme-science', questions: 10 }],
    })
    const rounds = await builder.buildRounds(room, 5)

    assert.equal(rounds.length, 2, 'only 2 science questions exist')
  })
})
