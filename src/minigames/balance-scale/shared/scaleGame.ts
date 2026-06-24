/**
 * @file scaleGame.ts
 * @description Public barrel for the balance-scale model. Pure logic only — no
 * sockets, database, browser APIs, or asset loading. The implementation lives in
 * the sibling scaleGame.* modules (constants, types, physics, equations,
 * generate, display).
 */
export {
  ANSWERING_SCALE_PHASE,
  BEAM_HALF_WIDTH,
  EASY_SCALE_DIFFICULTY,
  HARD_SCALE_DIFFICULTY,
  LEFT_SIDE,
  PIVOT_COLOR,
  PIVOT_X,
  PIVOT_Y,
  REVEAL_SCALE_PHASE,
  RIGHT_SIDE,
  SCALE_DIFFICULTIES,
  SCALE_PHASES,
  SCALE_SIDES,
  SLOT_SIZE,
  SVG_HEIGHT,
  SVG_WIDTH,
} from './scaleGame.constants.js'
export type { ScaleDifficulty, ScalePhase, Side, SideSign } from './scaleGame.constants.js'
export type {
  ItemOption,
  ItemStack,
  PlacedItem,
  ScaleEquation,
  ScalePuzzle,
  ScalePuzzleGenerationInput,
  ScalePuzzleRulesInput,
  ScaleSlotPosition,
} from './scaleGame.types.js'
export {
  angleForItems,
  clamp,
  getBalancingOptions,
  getSlotX,
  neededTorqueForBalance,
  requiredWeightForBalance,
  sideSign,
  torqueOf,
  totalTorque,
} from './scaleGame.physics.js'
export { createMinimumEquations } from './scaleGame.equations.js'
export { createScalePuzzleFromRules, generateScalePuzzle } from './scaleGame.generate.js'
export { getCorrectOption, getDisplayedItems } from './scaleGame.display.js'
