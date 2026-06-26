/**
 * @file serpentine.types.ts
 * @owner host-squad
 * @description Types for the boustrophedon "snake" grid (see serpentine.ts).
 */

export type ArrowDir = 'right' | 'left' | 'down' | 'none'

export interface SerpentineCell {
  logicalIndex: number
  visualPos: number
  row: number
  col: number
  arrow: ArrowDir
}

export interface Serpentine {
  cells: SerpentineCell[]
  count: number
  logicalInsertForSlot: number[]
}

/** A cell's logical index paired with its row, in visual (reading) order. */
export interface VisualEntry {
  logicalIndex: number
  rowIndex: number
}
