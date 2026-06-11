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
  /**
   * Keep server-side while players are answering.
   * Client answer payload: { roomId, playerId, puzzleId, optionId }.
   */
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
  /**
   * Later: load from DB/static content by room/round.
   * Store image references here, not image binary data.
   */
  itemPool: ItemOption[]
}
