import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createVaultRushRound } from '@brain-wiz/minigames/vault-rush/shared/vaultRushGame.js'
import { VAULT_RUSH_DIGIT_COUNT } from '@brain-wiz/minigames/vault-rush/shared/vaultRushGame.constants.js'

function getCodeDigits(code: string): [number, number, number, number] {
  assert.match(code, /^\d{4}$/)

  return [Number(code[0]), Number(code[1]), Number(code[2]), Number(code[3])]
}

describe('vaultRushGame', () => {
  it('generates a vault rush round with a 4-digit code and clues', () => {
    const round = createVaultRushRound({
      id: 'test-vault-round',
      seed: 'room-1:round-1:vault-rush',
    })

    assert.equal(round.puzzle.id, 'test-vault-round')
    assert.equal(round.puzzle.digitCount, VAULT_RUSH_DIGIT_COUNT)
    assert.equal(round.code.length, VAULT_RUSH_DIGIT_COUNT)
    assert.match(round.code, /^\d{4}$/)
    assert.equal(round.puzzle.clues.length, VAULT_RUSH_DIGIT_COUNT)
  })

  it('creates one clue for each digit position', () => {
    const round = createVaultRushRound({
      id: 'clue-test-round',
      seed: 'room-1:round-2:vault-rush',
    })

    assert.deepEqual(
      round.puzzle.clues.map((clue) => clue.digitIndex),
      [1, 2, 3, 4]
    )

    round.puzzle.clues.forEach((clue) => {
      assert.equal(typeof clue.text, 'string')
      assert.equal(clue.text.length > 0, true)
    })
  })

  it('uses the same code and clues for the same seed', () => {
    const input = {
      id: 'seeded-vault-round',
      seed: 'room-1:round-3:vault-rush',
    }

    const firstRound = createVaultRushRound(input)
    const secondRound = createVaultRushRound(input)

    assert.equal(firstRound.code, secondRound.code)
    assert.deepEqual(firstRound.puzzle.clues, secondRound.puzzle.clues)
  })

  it('keeps the generated code inside the expected digit rules', () => {
    const round = createVaultRushRound({
      id: 'rules-test-round',
      seed: 'room-1:round-4:vault-rush',
    })

    const [digitOne, digitTwo, digitThree, digitFour] = getCodeDigits(round.code)

    assert.ok(digitOne >= 1 && digitOne <= 4)
    assert.ok(digitTwo >= 2)
    assert.equal(digitThree, digitOne + digitTwo)
    assert.equal(digitFour, 10 - digitThree)
    assert.equal(digitOne + digitTwo + digitFour, 10)
  })

  it('creates clues that explain the generated code structure', () => {
    const round = createVaultRushRound({
      id: 'structure-test-round',
      seed: 'room-1:round-5:vault-rush',
    })

    assert.match(round.puzzle.clues[0]?.text ?? '', /^Digit 1 = /)
    assert.match(round.puzzle.clues[1]?.text ?? '', /^Digit 2 = /)
    assert.equal(round.puzzle.clues[2]?.text, 'Digit 3 = Digit 1 + Digit 2')
    assert.equal(round.puzzle.clues[3]?.text, 'Digit 4 = 10 - Digit 3')
  })

  it('generates simple math clues for the first two digits', () => {
    const round = createVaultRushRound({
      id: 'math-clue-test-round',
      seed: 'room-1:round-6:vault-rush',
    })

    assert.match(round.puzzle.clues[0]?.text ?? '', /^Digit 1 = \d [+-] \d$/)
    assert.match(round.puzzle.clues[1]?.text ?? '', /^Digit 2 = \d [+-] \d$/)
  })
})
