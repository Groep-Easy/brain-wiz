import type { PlacedItem, ScalePuzzle } from '../shared/scaleGame.js'
import type { ScalePhase, Side } from '../shared/scaleGame.constants.js'

export interface BalanceScaleProps {
  puzzle: ScalePuzzle
  phase: ScalePhase
  debugPivot?: boolean
}

export interface ItemCardProps {
  item: PlacedItem
  angle: number
  stackOffsetX: number
}

export interface QuestionMarkerProps {
  side: Side
  slot: number
  angle: number
  stackOffsetX: number
}

export interface ItemLayout {
  item: PlacedItem
  key: string
  stackOffsetX: number
}

export interface QuestionLayout {
  side: Side
  slot: number
  stackOffsetX: number
}
