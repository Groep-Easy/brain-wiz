/**
 * @file question.service.test.ts
 * @owner server-squad
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { QuestionService } from '../../src/server/question/question.service.js'
import { DifficultyEnum, QuestionThemeEnum } from '../../src/server/entities/enums.js'
import type { Question } from '../../src/server/entities/question.entity.js'
import type { ConnectionRegistry } from '../../src/server/room/lobby/connection-registry.js'
import type { ClientSocket } from '../../src/server/room/lobby/lobby.types.js'
import { QUESTION_SHOW } from '../../src/shared/events/socket-events.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface FakeRepo {
  find: () => Promise<Question[]>
  create: (p: Partial<Question>) => Question
  save: (q: Question) => Promise<Question>
}

interface FakeRegistry {
  lookup: (socket: ClientSocket) => ReturnType<ConnectionRegistry['lookup']>
}

interface FakeBroadcaster {
  emitToRoom: (...args: unknown[]) => void
}

interface FakeRoomService {
  findById: (id: string) => Promise<{ usedQuestionsIds: string[] } | null>
  appendUsedQuestionsId: (roomId: string, questionId: string) => Promise<void>
}

/** A room mock whose used-question list is empty, so any question is eligible. */
function fakeRoomService(): FakeRoomService {
  return {
    findById: async () => ({ usedQuestionsIds: [] }),
    appendUsedQuestionsId: async () => undefined,
  }
}

function makeService(
  repo: Partial<FakeRepo>,
  registry: Partial<FakeRegistry> = {},
  broadcaster: Partial<FakeBroadcaster> = {},
  roomService: Partial<FakeRoomService> = {}
): QuestionService {
  return new QuestionService(
    repo as never,
    registry as never,
    broadcaster as never,
    roomService as never
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

function hostSocket(): ClientSocket {
  return { send: (): void => undefined }
}

// ---------------------------------------------------------------------------
// getRandomQuestion
// ---------------------------------------------------------------------------

describe('QuestionService.getRandomQuestion', () => {
  it('returns null when there are no questions in the database', async () => {
    const service = makeService({ find: async () => [] })
    const result = await service.getRandomQuestion([])
    assert.equal(result, null)
  })

  it('returns the only question when there is exactly one', async () => {
    const service = makeService({ find: async () => [sampleQuestion] })
    const result = await service.getRandomQuestion([])
    assert.deepEqual(result, sampleQuestion)
  })

  it('returns one of the available questions when there are multiple', async () => {
    const questions = [
      { ...sampleQuestion, id: 'id-1', text: 'Question 1' },
      { ...sampleQuestion, id: 'id-2', text: 'Question 2' },
      { ...sampleQuestion, id: 'id-3', text: 'Question 3' },
    ] as never as Question[]
    const service = makeService({ find: async () => questions })
    const result = await service.getRandomQuestion([])
    assert.ok(result !== null)
    assert.ok(questions.some((q) => q.id === result?.id))
  })
})

// ---------------------------------------------------------------------------
// sendQuestionToRoom
// ---------------------------------------------------------------------------

describe('QuestionService.sendQuestionToRoom', () => {
  it('broadcasts the question text to the room when called by a host', async () => {
    const socket = hostSocket()
    const emitted: unknown[] = []

    const registry: FakeRegistry = {
      lookup: () => ({ roomId: 'room-1', role: 'host' as const }),
    }
    const broadcaster: FakeBroadcaster = {
      emitToRoom: (...args) => emitted.push(args),
    }
    const service = makeService(
      { find: async () => [sampleQuestion] },
      registry,
      broadcaster,
      fakeRoomService()
    )

    await service.sendQuestionToRoom(socket)

    assert.equal(emitted.length, 1)
    assert.deepEqual(emitted[0], ['room-1', QUESTION_SHOW, { question: sampleQuestion.text }])
  })

  it('does nothing when the socket is not registered as a host', async () => {
    const socket = hostSocket()
    const emitted: unknown[] = []

    const registry: FakeRegistry = {
      lookup: () => undefined,
    }
    const broadcaster: FakeBroadcaster = {
      emitToRoom: (...args) => emitted.push(args),
    }
    const service = makeService({ find: async () => [sampleQuestion] }, registry, broadcaster)

    await service.sendQuestionToRoom(socket)

    assert.equal(emitted.length, 0)
  })

  it('does nothing when there are no questions in the database', async () => {
    const socket = hostSocket()
    const emitted: unknown[] = []

    const registry: FakeRegistry = {
      lookup: () => ({ roomId: 'room-1', role: 'host' as const }),
    }
    const broadcaster: FakeBroadcaster = {
      emitToRoom: (...args) => emitted.push(args),
    }
    const service = makeService({ find: async () => [] }, registry, broadcaster, fakeRoomService())

    await service.sendQuestionToRoom(socket)

    assert.equal(emitted.length, 0)
  })

  it('does nothing when the socket belongs to a client, not a host', async () => {
    const socket = hostSocket()
    const emitted: unknown[] = []

    const registry: FakeRegistry = {
      lookup: () => ({ roomId: 'room-1', role: 'client' as const, clientId: 'c-1' }),
    }
    const broadcaster: FakeBroadcaster = {
      emitToRoom: (...args) => emitted.push(args),
    }
    const service = makeService({ find: async () => [sampleQuestion] }, registry, broadcaster)

    await service.sendQuestionToRoom(socket)

    assert.equal(emitted.length, 0)
  })
})
