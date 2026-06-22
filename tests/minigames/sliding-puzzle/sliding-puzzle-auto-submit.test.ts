import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  handleSlidingPuzzleBoardUpdate,
  shouldAutoSubmitSlidingPuzzleBoard,
} from '@brain-wiz/minigames/components/slidingPuzzleAutoSubmit'
import {
  SOLVED_BOARD,
  type SlidingPuzzleBoard,
} from '@brain-wiz/minigames/sliding-puzzle/shared/slidingPuzzleGame'

describe('sliding puzzle auto submit', () => {
  it('auto-submits only a solved board during active play', () => {
    assert.equal(shouldAutoSubmitSlidingPuzzleBoard(SOLVED_BOARD, false, 'playing'), true)
    assert.equal(
      shouldAutoSubmitSlidingPuzzleBoard([1, 2, 3, 4, 5, 6, 0, 7, 8], false, 'playing'),
      false
    )
    assert.equal(shouldAutoSubmitSlidingPuzzleBoard(SOLVED_BOARD, true, 'playing'), false)
    assert.equal(shouldAutoSubmitSlidingPuzzleBoard(SOLVED_BOARD, false, 'reveal'), false)
  })

  it('submits the solved board from the board-change flow', () => {
    const progress: SlidingPuzzleBoard[] = []
    const submissions: SlidingPuzzleBoard[] = []

    handleSlidingPuzzleBoardUpdate({
      board: SOLVED_BOARD,
      submitted: false,
      phase: 'playing',
      onProgress: ({ board }) => {
        progress.push(board)
      },
      onSubmit: ({ board }) => {
        submissions.push(board)
      },
    })

    assert.deepEqual(progress, [SOLVED_BOARD])
    assert.deepEqual(submissions, [SOLVED_BOARD])
  })

  it('keeps unfinished boards as progress without submitting them', () => {
    const partialBoard = [1, 2, 3, 4, 5, 6, 0, 7, 8]
    const progress: SlidingPuzzleBoard[] = []
    const submissions: SlidingPuzzleBoard[] = []

    handleSlidingPuzzleBoardUpdate({
      board: partialBoard,
      submitted: false,
      phase: 'playing',
      onProgress: ({ board }) => {
        progress.push(board)
      },
      onSubmit: ({ board }) => {
        submissions.push(board)
      },
    })

    assert.deepEqual(progress, [partialBoard])
    assert.deepEqual(submissions, [])
  })
})
