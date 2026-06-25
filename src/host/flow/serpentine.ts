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
import type { ArrowDir, Serpentine, SerpentineCell, VisualEntry } from './serpentine.types'

export type { ArrowDir, Serpentine, SerpentineCell } from './serpentine.types'

/** The logical indices of one row, in reading order (reversed on odd rows). */
function rowOrder(start: number, end: number, rowIndex: number): number[] {
  const ascending = Array.from({ length: Math.max(0, end - start) }, (_, i) => start + i)
  return rowIndex % 2 === 1 ? ascending.reverse() : ascending
}

/** Place each flow index into its snake cell and record the visual order. */
function buildCells(
  length: number,
  cols: number
): { cells: SerpentineCell[]; visual: VisualEntry[] } {
  const cells: SerpentineCell[] = []
  const visual: VisualEntry[] = []
  for (let rowIndex = 0; rowIndex * cols < length; rowIndex++) {
    const start = rowIndex * cols
    const end = Math.min(length, start + cols)
    for (const logicalIndex of rowOrder(start, end, rowIndex)) {
      // Reading position within the row, then its grid column (reversed rows
      // count down from the right so the snake turns under the previous block).
      const positionInRow = logicalIndex - start
      const col = rowIndex % 2 === 0 ? positionInRow + 1 : cols - positionInRow
      cells.push({ logicalIndex, visualPos: cells.length, row: rowIndex, col, arrow: 'none' })
      visual.push({ logicalIndex, rowIndex })
    }
  }
  return { cells, visual }
}

/**
 * The connector drawn from a cell toward the next flow step: down when the next
 * step wraps to a new row, otherwise along the row's reading direction.
 */
function arrowFor(logicalIndex: number, length: number, cols: number): ArrowDir {
  if (logicalIndex >= length - 1) return 'none'
  const rowOfThis = Math.floor(logicalIndex / cols)
  const rowOfNext = Math.floor((logicalIndex + 1) / cols)
  if (rowOfNext !== rowOfThis) return 'down'
  return rowOfThis % 2 === 0 ? 'right' : 'left'
}

/** The logical splice index for the gap just before `current` (after `prev`). */
function gapInsertIndex(prev: VisualEntry, current: VisualEntry): number {
  const isSameRow = prev.rowIndex === current.rowIndex
  const isEvenRow = prev.rowIndex % 2 === 0
  return isSameRow && !isEvenRow ? prev.logicalIndex : prev.logicalIndex + 1
}

/** Map each visual drop slot (0..n) back to an index into the linear flow. */
function buildInsertSlots(visual: VisualEntry[], length: number): number[] {
  const n = visual.length
  const slots = new Array<number>(n + 1)
  slots[0] = 0
  slots[n] = length
  for (let k = 1; k < n; k++) {
    const prev = visual[k - 1]
    const current = visual[k]
    if (prev === undefined || current === undefined) continue
    slots[k] = gapInsertIndex(prev, current)
  }
  return slots
}

/** Build the snake grid for a flow of `length` items at `columns` per row. */
export function buildSerpentine(length: number, columns: number): Serpentine {
  const cols = Math.max(1, columns)
  const { cells, visual } = buildCells(length, cols)
  for (const cell of cells) {
    cell.arrow = arrowFor(cell.logicalIndex, length, cols)
  }
  return { cells, count: visual.length, logicalInsertForSlot: buildInsertSlots(visual, length) }
}
