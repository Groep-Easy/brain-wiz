import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { QuestionController } from '../../src/server/question/question.controller'
import type { QuestionService } from '../../src/server/question/question.service'
import { CreateQuestionDto } from '../../src/server/question/dto/create-question.dto'
import { DifficultyEnum, QuestionThemeEnum } from '../../src/server/entities/enums'
import { validate } from 'class-validator'
import { plainToInstance } from 'class-transformer'

function controllerWith(overrides: Partial<QuestionService>): QuestionController {
  return new QuestionController(overrides as QuestionService)
}

describe('QuestionController.createQuestion', () => {
  it('returns the generated question id', async () => {
    const controller = controllerWith({
      createQuestion: async () => 'mocked-uuid',
    })

    const payload: CreateQuestionDto = {
      text: 'What is 2+2?',
      theme: QuestionThemeEnum.SCIENCE,
      difficulty: DifficultyEnum.EASY,
      correctAnswers: ['4'],
      wrongAnswers: ['5'],
    }

    const result = await controller.createQuestion(payload)
    assert.deepEqual(result, { id: 'mocked-uuid' })
  })
})

describe('CreateQuestionDto Validation', () => {
  it('rejects arrays with empty strings', async () => {
    const payload = plainToInstance(CreateQuestionDto, {
      text: 'What is 2+2?',
      theme: QuestionThemeEnum.SCIENCE,
      difficulty: DifficultyEnum.EASY,
      correctAnswers: [''],
    })
    const errors = await validate(payload)
    assert.ok(errors.length > 0)
    const ansError = errors.find((e) => e.property === 'correctAnswers')
    assert.ok(ansError)
  })

  it('rejects integers over the max limit', async () => {
    const payload = plainToInstance(CreateQuestionDto, {
      text: 'What is 2+2?',
      theme: QuestionThemeEnum.SCIENCE,
      difficulty: DifficultyEnum.EASY,
      correctAnswers: ['4'],
      wrongAnswers: ['5'],
      basePoints: 9999999, // overflows 32767
    })
    const errors = await validate(payload)
    assert.ok(errors.length > 0)
    const pointsError = errors.find((e) => e.property === 'basePoints')
    assert.ok(pointsError)
  })
})
