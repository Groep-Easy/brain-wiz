import type { ItemStack, ScaleEquation } from '../shared/scaleGame.js'

export interface EquationClueProps {
  equation: ScaleEquation
}

export interface EquationSideProps {
  stacks: ItemStack[]
}
