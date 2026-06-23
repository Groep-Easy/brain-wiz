/**
 * @file question-service.test.ts
 * @owner server-squad
 */
import { describe, it } from 'node:test'
import * as assert from 'node:assert/strict'
import { QuestionService } from '../../src/server/question/question.service.js'
import { DifficultyEnum, QuestionThemeEnum } from '../../src/server/entities/enums.js'
import type { Question } from '../../src/server/entities/question.entity.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeService(questionsList: Question[]): QuestionService {
  const repo = {
    createQueryBuilder: (): unknown => {
      let list = [...questionsList]
      const qb = {
        where: (_condition: string, params: { usedIds: string[] }): unknown => {
          if (params && params.usedIds) {
            list = list.filter((q) => !params.usedIds.includes(q.id))
          }
          return qb
        },
        getMany: async (): Promise<Question[]> => list,
      }
      return qb
    },
  }
  return new QuestionService(
    repo as unknown as import('typeorm').Repository<Question>,
    {} as import('../../src/server/room/lobby/connection-registry').ConnectionRegistry,
    {} as import('../../src/server/room/lobby/room-broadcaster').RoomBroadcaster
  )
}

const sampleQuestion: Question = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  text: 'What is the capital of France?',
  theme: QuestionThemeEnum.GEOGRAPHY,
  difficulty: DifficultyEnum.EASY,
  correctAnswers: ['Paris'],
  wrongAnswers: ['Berlin', 'Madrid', 'Rome'],
  imagePath: '/images/placeholder.jpg',
  timeLimitSeconds: 30,
  basePoints: 1000,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
  rounds: [],

  validateAnswers() {
    /* empty */
  },
}

// ---------------------------------------------------------------------------
// getRandomQuestion
// ---------------------------------------------------------------------------

describe('QuestionService.getRandomQuestion', () => {
  it('returns null when there are no questions in the database', async () => {
    const service = makeService([])
    const result = await service.getRandomQuestion()
    assert.equal(result, null)
  })

  it('returns the only question when there is exactly one', async () => {
    const service = makeService([sampleQuestion])
    const result = await service.getRandomQuestion()
    assert.deepEqual(result, sampleQuestion)
  })

  it('returns one of the available questions when there are multiple', async () => {
    const questions = [
      { ...sampleQuestion, id: 'id-1', text: 'Question 1' },
      { ...sampleQuestion, id: 'id-2', text: 'Question 2' },
      { ...sampleQuestion, id: 'id-3', text: 'Question 3' },
    ] as never as Question[]
    const service = makeService(questions)
    const result = await service.getRandomQuestion()
    assert.ok(result !== null)
    assert.ok(questions.some((q) => q.id === result?.id))
  })
})
