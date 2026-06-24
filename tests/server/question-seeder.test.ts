/**
 * @file question-seeder.test.ts
 * @owner server-squad
 */
import { describe, it } from 'node:test'
import * as assert from 'node:assert/strict'
import { toQuestionFields } from '../../src/server/database/question-seeder.service.js'
import { DEFAULT_BASE_POINTS } from '../../src/server/database/question-seeder.constants.js'
import { DifficultyEnum, QuestionThemeEnum } from '../../src/server/entities/enums.js'
import type { SeedQuestion } from '../../src/server/database/question-seeder.types.js'

function seed(overrides: Partial<SeedQuestion> = {}): SeedQuestion {
  return {
    text: 'What is 2 + 2?',
    theme: QuestionThemeEnum.GEOGRAPHY,
    difficulty: DifficultyEnum.EASY,
    correctAnswers: ['4'],
    wrongAnswers: ['5'],
    timeLimitSeconds: 30,
    ...overrides,
  }
}

describe('toQuestionFields', () => {
  it('copies the question fields straight through', () => {
    const fields = toQuestionFields(seed({ imagePath: '/img.png', basePoints: 500 }))
    assert.equal(fields.text, 'What is 2 + 2?')
    assert.deepEqual(fields.correctAnswers, ['4'])
    assert.equal(fields.imagePath, '/img.png')
    assert.equal(fields.basePoints, 500)
  })

  it('defaults a missing image path to an empty string', () => {
    assert.equal(toQuestionFields(seed()).imagePath, '')
    assert.equal(toQuestionFields(seed({ imagePath: '' })).imagePath, '')
  })

  it('defaults missing base points but keeps an explicit zero', () => {
    assert.equal(toQuestionFields(seed()).basePoints, DEFAULT_BASE_POINTS)
    assert.equal(toQuestionFields(seed({ basePoints: 0 })).basePoints, 0)
  })
})
