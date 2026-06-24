import type { ScaleDifficulty, Side } from './scaleGame.constants.js'

export interface ItemOption {
  id: string
  label: string
  emoji: string
  weight: number
}

export interface PlacedItem extends ItemOption {
  side: Side
  slot: number
  isNew?: boolean
}

export interface ScaleSlotPosition {
  side: Side
  slot: number
}

export interface ItemStack {
  item: ItemOption
  count: number
}

export interface ScaleEquation {
  id: string
  left: ItemStack[]
  right: ItemStack[]
}

export interface ScalePuzzle {
  id: string
  placed: PlacedItem[]
  addTo: ScaleSlotPosition
  options: ItemOption[]
  equations: ScaleEquation[]
  correctOptionId?: string
}

export interface ScalePuzzleRulesInput {
  id: string
  placed: PlacedItem[]
  addTo: ScaleSlotPosition
  options: ItemOption[]
  equations?: ScaleEquation[]
}

export interface ScalePuzzleGenerationInput {
  id: string
  seed?: string
  difficulty: ScaleDifficulty
  itemPool: ItemOption[]
}

export interface ScaleVariantLayout {
  placed: ReadonlyArray<readonly [itemIndex: number, side: Side]>
  addTo: Side
}
