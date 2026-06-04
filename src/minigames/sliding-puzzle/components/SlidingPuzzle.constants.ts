export const SCRAMBLED_PUZZLE_STATUS = 'Scrambled'
export const PLAYING_PUZZLE_STATUS = 'Playing'
export const SOLVED_PUZZLE_STATUS = 'Solved'
export const SOLVING_PUZZLE_STATUS = 'Solving'
export const NO_SOLUTION_PUZZLE_STATUS = 'No solution'

export const SLIDING_PUZZLE_STATUSES = [
  SCRAMBLED_PUZZLE_STATUS,
  PLAYING_PUZZLE_STATUS,
  SOLVED_PUZZLE_STATUS,
  SOLVING_PUZZLE_STATUS,
  NO_SOLUTION_PUZZLE_STATUS,
] as const

export type PuzzleStatus = (typeof SLIDING_PUZZLE_STATUSES)[number]
