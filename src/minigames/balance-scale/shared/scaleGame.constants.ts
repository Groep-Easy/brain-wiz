export const LEFT_SIDE = 'left'
export const RIGHT_SIDE = 'right'
export const SCALE_SIDES = [LEFT_SIDE, RIGHT_SIDE] as const

export type Side = (typeof SCALE_SIDES)[number]

export const EASY_SCALE_DIFFICULTY = 'easy'
export const HARD_SCALE_DIFFICULTY = 'hard'
export const SCALE_DIFFICULTIES = [EASY_SCALE_DIFFICULTY, HARD_SCALE_DIFFICULTY] as const

export type ScaleDifficulty = (typeof SCALE_DIFFICULTIES)[number]

export const ANSWERING_SCALE_PHASE = 'answering'
export const REVEAL_SCALE_PHASE = 'reveal'
export const SCALE_PHASES = [ANSWERING_SCALE_PHASE, REVEAL_SCALE_PHASE] as const

export type ScalePhase = (typeof SCALE_PHASES)[number]

// --- Visual layout (consumed by the BalanceScale component) ---
export const SVG_WIDTH = 800
export const SVG_HEIGHT = 480
export const PIVOT_X = 400
export const PIVOT_Y = 260
export const SLOT_SIZE = 90
export const BEAM_HALF_WIDTH = 280
export const PIVOT_COLOR = '#ff2bd6'

// --- Physics / scoring ---
export const DEGREES_PER_TORQUE = 4
export const MIN_VISUAL_ANGLE = -16
export const MAX_VISUAL_ANGLE = 16
export const WEIGHT_MATCH_EPSILON = 0.0001
export const LEFT_SIDE_SIGN = -1
export const RIGHT_SIDE_SIGN = 1

export type SideSign = typeof LEFT_SIDE_SIGN | typeof RIGHT_SIDE_SIGN

// --- Puzzle generation ---
export const DIFFICULTY_ITEM_COUNT: Record<ScaleDifficulty, number> = {
  [EASY_SCALE_DIFFICULTY]: 3,
  [HARD_SCALE_DIFFICULTY]: 4,
}

// --- Puzzle generation: variant layouts ---
export const DIFFICULTY_EQUATION_COUNT: Record<ScaleDifficulty, number> = {
  [EASY_SCALE_DIFFICULTY]: 2,
  [HARD_SCALE_DIFFICULTY]: 3,
}

// --- Puzzle generation: variant layouts ---
export const GENERATED_SCALE_SLOT = 2
export const MIN_SCALE_ITEM_TYPES = 2
export const NUMERIC_SUFFIX_PATTERN = /\d+$/

// --- Puzzle generation: variant layouts ---
export const LIGHTEST = 0
export const SECOND = 1
export const THIRD = 2
export const FOURTH = 3
