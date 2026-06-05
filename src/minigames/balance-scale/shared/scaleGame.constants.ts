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
