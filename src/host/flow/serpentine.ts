/**
 * @file serpentine.ts
 * @owner host-squad
 * @description Turns a linear flow (index 0..n-1) into a boustrophedon / "snake"
 * grid: the first row reads left-to-right, the next right-to-left, and so on, at
 * a fixed number of columns. The blocks are rendered in visual (reading) order
 * into a CSS grid, so they always line up in columns and nothing can overflow.
 *
 * Each cell also carries the direction of the connector to the next step (right
 * / left within a row, or down to the row below). And we expose a mapping from a
 * visual drop slot back to an index into the original linear flow, used by the
 * editor's drag-and-drop.
 */

export type ArrowDir = 'right' | 'left' | 'down' | 'none'

export interface SerpentineCell {
  /** Index into the original linear flow. */
  logicalIndex: number
  /** Position in visual (left-to-right, top-to-bottom) reading order. */
  visualPos: number
  /** 0-based grid row. */
  row: number
  /** 1-based grid column. Reversed rows count down so a partial row stays under
   *  the end of the row above it. */
  col: number
  /** The connector drawn from this cell toward the next step. */
  arrow: ArrowDir
}

export interface Serpentine {
  /** Cells in the order they should be rendered (visual order). */
  cells: SerpentineCell[]
  /** Total number of cells (== `length`). */
  count: number
  /**
   * For each visual drop slot (0..count), the index to splice into the *logical*
   * flow. Slot k sits just before the cell at visual position k.
   */
  logicalInsertForSlot: number[]
}

/** Build the snake grid for a flow of `length` items at `columns` per row. */
export function buildSerpentine(length: number, columns: number): Serpentine {
  const cols = Math.max(1, columns)
  const cells: SerpentineCell[] = []
  // Flat record of each visual position's logical index, for the drop mapping.
  const visual: { logicalIndex: number; rowIndex: number }[] = []

  for (let rowIndex = 0; rowIndex * cols < length; rowIndex++) {
    const start = rowIndex * cols
    const end = Math.min(length, start + cols)
    const ascending: number[] = []
    for (let i = start; i < end; i++) ascending.push(i)
    const ordered = rowIndex % 2 === 1 ? ascending.reverse() : ascending
    for (const logicalIndex of ordered) {
      // Reading position within the row, then its grid column (reversed rows
      // count down from the right so the snake turns under the previous block).
      const positionInRow = logicalIndex - start
      const col = rowIndex % 2 === 0 ? positionInRow + 1 : cols - positionInRow
      cells.push({ logicalIndex, visualPos: cells.length, row: rowIndex, col, arrow: 'none' })
      visual.push({ logicalIndex, rowIndex })
    }
  }

  // Connector per cell, by *flow* adjacency: down when the next step is on the
  // next row, otherwise along the row's reading direction.
  for (const cell of cells) {
    const L = cell.logicalIndex
    if (L >= length - 1) continue
    const rowOfL = Math.floor(L / cols)
    const rowOfNext = Math.floor((L + 1) / cols)
    if (rowOfNext !== rowOfL) cell.arrow = 'down'
    else cell.arrow = rowOfL % 2 === 0 ? 'right' : 'left'
  }

  // Map each visual drop slot back to a logical splice index. Every gap between
  // two visually adjacent cells corresponds to exactly one step in flow order.
  const n = visual.length
  const logicalInsertForSlot = new Array<number>(n + 1)
  logicalInsertForSlot[0] = 0
  logicalInsertForSlot[n] = length
  for (let k = 1; k < n; k++) {
    const prev = visual[k - 1]
    const current = visual[k]
    if (prev === undefined || current === undefined) {
      continue
    }
    const isSameRow = prev.rowIndex === current.rowIndex
    const isEvenRow = prev.rowIndex % 2 === 0
    logicalInsertForSlot[k] = isSameRow && !isEvenRow ? prev.logicalIndex : prev.logicalIndex + 1
  }

  return { cells, count: n, logicalInsertForSlot }
}
