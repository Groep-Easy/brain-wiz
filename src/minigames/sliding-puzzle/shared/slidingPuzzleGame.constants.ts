export const BOARD_SIZE = 3
const TILE_COUNT = BOARD_SIZE * BOARD_SIZE

export const SOLVED_BOARD = Array.from({ length: TILE_COUNT }, (_value, index) =>
  index + 1 === TILE_COUNT ? 0 : index + 1
)

export const DEFAULT_SCRAMBLE_MOVES = 80
export const SOLVE_STEP_MS = 180
export const FALLBACK_BOARD_SIZE = 320

export const FIRST_INDEX = 0
export const TILE_BACKGROUND_STEP_PERCENT = 50
export const INVERSION_PARITY_DIVISOR = 2
export const HEAP_LEFT_CHILD_OFFSET = 1
export const HEAP_RIGHT_CHILD_OFFSET = 1
export const HEAP_PARENT_OFFSET = 1
export const HEAP_CHILD_FACTOR = 2
