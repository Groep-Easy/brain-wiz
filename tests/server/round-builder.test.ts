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
import { TIMER } from '@brain-wiz/config/game.config'

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
      minigameKey: null,
    }),
    Object.assign(new GameBlock(), {
      id: 'theme-history',
      kind: BlockKindEnum.THEME,
      theme: QuestionThemeEnum.HISTORY,
      minigameKey: null,
    }),
    Object.assign(new GameBlock(), {
      id: 'mini-balance-scale',
      kind: BlockKindEnum.MINIGAME,
      theme: null,
      minigameKey: 'balance-scale',
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

function fakeMinigameRegistry(): unknown {
  return {
    get: (type: string): unknown => {
      if (type !== 'sliding-puzzle' && type !== 'balance-scale' && type !== 'vault-rush') {
        return undefined
      }

      return {
        type,
        createRound: (input: { seed: string; timeLimitSeconds: number }): unknown => ({
          type,
          seed: input.seed,
          publicState: { setup: type },
          privateState: { solution: type },
          scoringConfig: { points: 100, timeLimitSeconds: input.timeLimitSeconds },
        }),
      }
    },
  }
}

function makeBuilder(questions: Repository<Question>): RoundBuilder {
  return new RoundBuilder(
    questions,
    fakeRoundRepo(),
    fakeRoomRepo(),
    fakeBlockRepo(),
    fakeMinigameRegistry() as never
  )
}

function makeRoom(): Room {
  return Object.assign(new Room(), { id: 'room-1', totalRounds: 4 })
}

describe('RoundBuilder', () => {
  it('builds the default mixed sequence with shared procedural round state', async () => {
    const builder = makeBuilder(fakeQuestionRepo(10))
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
      ['quiz', 'balance-scale', 'sliding-puzzle', 'vault-rush', 'quiz']
    )
    assert.deepEqual(
      rounds.map((r: Round) => r.contentType),
      [
        ContentTypeEnum.QUESTION,
        ContentTypeEnum.PUZZLE,
        ContentTypeEnum.PUZZLE,
        ContentTypeEnum.PUZZLE,
        ContentTypeEnum.QUESTION,
      ]
    )
    assert.deepEqual(
      rounds.map((r: Round) => r.timeLimitSeconds),
      [
        TIMER.QUESTION_SECONDS,
        TIMER.QUESTION_SECONDS,
        TIMER.SLIDING_PUZZLE_SECONDS,
        TIMER.QUESTION_SECONDS,
        TIMER.QUESTION_SECONDS,
      ]
    )
    assert.deepEqual(rounds[2]?.scoringConfig, {
      points: 100,
      timeLimitSeconds: TIMER.SLIDING_PUZZLE_SECONDS,
    })
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
    const builder = makeBuilder(fakeQuestionRepo(1))
    await assert.rejects(async () => builder.buildRounds(makeRoom(), 5), NotEnoughQuestionsError)
  })

  it('expands a stored flow: theme blocks become questions, mini-game blocks become procedural rounds', async () => {
    const builder = makeBuilder(fakeThemedQuestionRepo(5))
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

    // 3 science + 1 minigame + 2 history = 6 rounds, in flow order.
    assert.equal(rounds.length, 6)
    assert.equal(room.totalRounds, 6)
    assert.deepEqual(
      rounds.map((r: Round) => r.roundIndex),
      [0, 1, 2, 3, 4, 5]
    )
    assert.deepEqual(
      rounds.map((r: Round) => r.gameType),
      ['quiz', 'quiz', 'quiz', 'balance-scale', 'quiz', 'quiz']
    )
    assert.equal(rounds.filter((r) => r.question?.theme === QuestionThemeEnum.SCIENCE).length, 3)
    assert.equal(rounds.filter((r) => r.question?.theme === QuestionThemeEnum.HISTORY).length, 2)
    const minigame = rounds[3]
    assert.equal(minigame?.contentType, ContentTypeEnum.PUZZLE)
    assert.ok(minigame?.seed)
    assert.ok(minigame?.publicState)
  })

  it('clamps a theme block to the questions actually available', async () => {
    const builder = makeBuilder(fakeThemedQuestionRepo(2))
    const room = Object.assign(new Room(), {
      id: 'room-clamp',
      totalRounds: 4,
      gameFlow: [{ blockId: 'theme-science', questions: 10 }],
    })
    const rounds = await builder.buildRounds(room, 5)

    assert.equal(rounds.length, 2, 'only 2 science questions exist')
  })
})
