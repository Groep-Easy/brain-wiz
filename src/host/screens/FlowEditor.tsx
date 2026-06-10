/**
 * @file FlowEditor.tsx
 * @owner host-squad
 * @description Drag-and-drop editor for building a custom game flow. The host
 * drags theme and mini-game blocks from the palette into the flow canvas, where
 * they can be reordered or removed. The whole canvas is a drop target: the drop
 * position is computed from the cursor, with a live insertion indicator. The
 * flow is persisted to localStorage and the lobby (in another tab) picks up
 * changes via the `storage` event. A flow must keep at least MIN_FLOW_BLOCKS.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PALETTE,
  MIN_FLOW_BLOCKS,
  MAX_FLOW_BLOCKS,
  MAX_FLOW_COLUMNS,
  DEFAULT_FLOW_SIZE,
  DEFAULT_QUESTIONS_PER_BLOCK,
  MIN_QUESTIONS_PER_BLOCK,
  MAX_QUESTIONS_PER_BLOCK,
  blockById,
  loadFlow,
  saveFlow,
  randomFlow,
  nextUid,
  type FlowItem,
} from '../flow/blocks'
import { buildSerpentine } from '../flow/serpentine'
import '../styles/flow_editor.css'

export function FlowEditor(): React.JSX.Element {
  const navigate = useNavigate()
  const trackRef = useRef<HTMLDivElement>(null)
  const [flow, setFlow] = useState<FlowItem[]>(() => {
    const existing = loadFlow()
    return existing.length >= MIN_FLOW_BLOCKS ? existing : randomFlow()
  })
  // The slot index a dragged block would be inserted at, or null when not dragging.
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  // Size picker shown when the host asks for a randomized flow.
  const [sizePicker, setSizePicker] = useState<number | null>(null)
  // The uid of the quiz block whose question-count popover is open, if any.
  const [settingsFor, setSettingsFor] = useState<string | null>(null)

  // Set how many questions a quiz block contributes, clamped to the allowed range.
  const setQuestions = (uid: string, value: number) => {
    const clamped = Math.min(
      MAX_QUESTIONS_PER_BLOCK,
      Math.max(MIN_QUESTIONS_PER_BLOCK, Math.round(value) || MIN_QUESTIONS_PER_BLOCK),
    )
    setFlow((prev) => prev.map((f) => (f.uid === uid ? { ...f, questions: clamped } : f)))
  }

  // The snake grid: cells in visual order + per-slot logical insert mapping. A
  // fixed MAX_FLOW_COLUMNS means a full flow lands as exact rows.
  const { cells, count, logicalInsertForSlot } = useMemo(
    () => buildSerpentine(flow.length, MAX_FLOW_COLUMNS),
    [flow.length],
  )

  // Persist whenever the flow changes; this notifies the lobby tab via `storage`.
  useEffect(() => {
    saveFlow(flow)
  }, [flow])

  // Close the question-count popover when clicking outside it.
  useEffect(() => {
    if (settingsFor === null) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.block-settings') && !target.closest('.settings-btn')) {
        setSettingsFor(null)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [settingsFor])

  // --- Drag sources -------------------------------------------------------
  const onPaletteDragStart = (e: React.DragEvent, blockId: string) => {
    e.dataTransfer.setData('application/x-source', 'palette')
    e.dataTransfer.setData('application/x-block', blockId)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const onFlowDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('application/x-source', 'flow')
    e.dataTransfer.setData('application/x-index', String(index))
    e.dataTransfer.effectAllowed = 'move'
  }

  // --- Whole-canvas drop target ------------------------------------------
  // Work out which slot the cursor is over in reading order: pick the first
  // block the cursor sits before, accounting for wrapped rows (Y then X).
  const computeDropIndex = (clientX: number, clientY: number): number => {
    const track = trackRef.current
    if (!track) return flow.length
    const blocks = Array.from(track.querySelectorAll<HTMLElement>('.canvas-block'))
    let index = 0
    for (const el of blocks) {
      const rect = el.getBoundingClientRect()
      const aboveRow = clientY < rect.top
      const inRow = clientY >= rect.top && clientY <= rect.bottom
      if (aboveRow) return index
      if (inRow && clientX < rect.left + rect.width / 2) return index
      index++
    }
    return blocks.length
  }

  const onCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDropIndex(computeDropIndex(e.clientX, e.clientY))
  }

  const onCanvasDragLeave = (e: React.DragEvent) => {
    // Only clear when the cursor actually leaves the canvas, not on child enter/leave.
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setDropIndex(null)
    }
  }

  const onCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const slot = computeDropIndex(e.clientX, e.clientY)
    // The cursor lands in a *visual* slot; map it back to a flow-order index.
    const index = logicalInsertForSlot[slot] ?? flow.length
    setDropIndex(null)
    const source = e.dataTransfer.getData('application/x-source')

    if (source === 'palette') {
      const blockId = e.dataTransfer.getData('application/x-block')
      if (!blockById(blockId)) return
      setFlow((prev) => {
        const next = [...prev]
        next.splice(index, 0, { uid: nextUid(), blockId })
        return next
      })
    } else if (source === 'flow') {
      const from = Number(e.dataTransfer.getData('application/x-index'))
      if (Number.isNaN(from)) return
      setFlow((prev) => {
        const next = [...prev]
        const [moved] = next.splice(from, 1)
        if (!moved) return prev
        // The removed item shifts later indices left by one.
        const target = from < index ? index - 1 : index
        next.splice(target, 0, moved)
        return next
      })
    }
  }

  const removeAt = (index: number) => {
    setFlow((prev) => (prev.length <= MIN_FLOW_BLOCKS ? prev : prev.filter((_, i) => i !== index)))
  }

  const openSizePicker = () => setSizePicker(flow.length || DEFAULT_FLOW_SIZE)

  const confirmShuffle = () => {
    if (sizePicker === null) return
    const count = Math.min(MAX_FLOW_BLOCKS, Math.max(MIN_FLOW_BLOCKS, sizePicker))
    setFlow(randomFlow(count))
    setSizePicker(null)
  }

  // Opened in a fresh tab from the lobby (no in-app history): close it.
  // Opened via in-app navigation: step back instead. Either way the lobby
  // already reflects the saved flow via the `storage` event.
  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      window.close()
    }
  }

  const atMinimum = flow.length <= MIN_FLOW_BLOCKS

  return (
    <div className="flow-editor">
      <header className="flow-editor-header">
        <button className="back-btn" onClick={handleBack} aria-label="Back to lobby">
          ← Back
        </button>
        <h1>Edit game flow</h1>
        <button className="shuffle-btn" onClick={openSizePicker} title="Generate a random flow">
          🎲 Randomize
        </button>
      </header>

      <p className="flow-editor-hint">
        Drag themes and mini-games into the flow. Drag blocks to reorder them. Minimum{' '}
        {MIN_FLOW_BLOCKS} blocks.
      </p>

      <div className="flow-editor-body">
        {/* Palette */}
        <aside className="palette">
          <h2>Themes</h2>
          <div className="palette-group">
            {PALETTE.filter((b) => b.kind === 'theme').map((block) => (
              <div
                key={block.id}
                className="palette-block theme"
                draggable
                onDragStart={(e) => onPaletteDragStart(e, block.id)}
              >
                <span className="block-icon">{block.icon}</span>
                <span className="block-label">{block.label}</span>
              </div>
            ))}
          </div>

          <h2>Mini-games</h2>
          <div className="palette-group">
            {PALETTE.filter((b) => b.kind === 'minigame').map((block) => (
              <div
                key={block.id}
                className="palette-block minigame"
                draggable
                onDragStart={(e) => onPaletteDragStart(e, block.id)}
              >
                <span className="block-icon">{block.icon}</span>
                <span className="block-label">{block.label}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* Canvas — the entire area is a drop target */}
        <section
          className="flow-canvas"
          onDragOver={onCanvasDragOver}
          onDragLeave={onCanvasDragLeave}
          onDrop={onCanvasDrop}
        >
          <div className="flow-canvas-track" ref={trackRef}>
            {cells.map((cell) => {
              const item = flow[cell.logicalIndex]
              if (!item) return null
              const block = blockById(item.blockId)
              if (!block) return null
              const lastCell = cell.visualPos === count - 1
              return (
                <div
                  className="canvas-cell"
                  key={item.uid}
                  style={{ gridRow: cell.row + 1, gridColumn: cell.col }}
                >
                  {dropIndex === cell.visualPos && <div className="drop-indicator before" />}
                  {lastCell && dropIndex === count && <div className="drop-indicator after" />}
                  <div
                    className={`canvas-block ${block.kind}`}
                    draggable
                    onDragStart={(e) => onFlowDragStart(e, cell.logicalIndex)}
                  >
                    <button
                      className="remove-block"
                      onClick={() => removeAt(cell.logicalIndex)}
                      disabled={atMinimum}
                      aria-label={`Remove ${block.label}`}
                      title={atMinimum ? `Minimum ${MIN_FLOW_BLOCKS} blocks` : 'Remove from flow'}
                    >
                      ×
                    </button>
                    {/* Quiz (theme) blocks let the host set how many questions they contribute. */}
                    {block.kind === 'theme' && (
                      <button
                        className={`settings-btn ${settingsFor === item.uid ? 'open' : ''}`}
                        draggable={false}
                        onClick={(e) => {
                          e.stopPropagation()
                          setSettingsFor((cur) => (cur === item.uid ? null : item.uid))
                        }}
                        aria-label={`Question count for ${block.label}`}
                        title="Number of questions"
                      >
                        ⚙
                      </button>
                    )}
                    <span className="block-icon">{block.icon}</span>
                    <span className="block-label">{block.label}</span>
                  </div>
                  {cell.arrow !== 'none' && (
                    <span className={`canvas-arrow arrow-${cell.arrow}`} aria-hidden="true">
                      {cell.arrow === 'down' ? '↓' : cell.arrow === 'left' ? '←' : '→'}
                    </span>
                  )}
                  {block.kind === 'theme' && settingsFor === item.uid && (
                    <div className="block-settings">
                      <label htmlFor={`questions-${item.uid}`}>Questions</label>
                      <input
                        id={`questions-${item.uid}`}
                        type="number"
                        min={MIN_QUESTIONS_PER_BLOCK}
                        max={MAX_QUESTIONS_PER_BLOCK}
                        value={item.questions ?? DEFAULT_QUESTIONS_PER_BLOCK}
                        autoFocus
                        onChange={(e) => setQuestions(item.uid, Number(e.target.value))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === 'Escape') setSettingsFor(null)
                        }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
            {count === 0 && (
              <div className="canvas-empty">Drag blocks here to build your game flow</div>
            )}
          </div>
        </section>
      </div>

      {/* Size picker — asks how many blocks a randomized flow should have */}
      {sizePicker !== null && (
        <div className="size-modal-backdrop" onClick={() => setSizePicker(null)}>
          <div className="size-modal" onClick={(e) => e.stopPropagation()}>
            <h2>How many blocks?</h2>
            <p className="size-modal-hint">
              Choose between {MIN_FLOW_BLOCKS} and {MAX_FLOW_BLOCKS} blocks.
            </p>
            <input
              type="number"
              className="size-input"
              min={MIN_FLOW_BLOCKS}
              max={MAX_FLOW_BLOCKS}
              value={sizePicker}
              autoFocus
              onChange={(e) => setSizePicker(Number(e.target.value))}
              onKeyDown={(e) => e.key === 'Enter' && confirmShuffle()}
            />
            <div className="size-modal-actions">
              <button className="size-cancel" onClick={() => setSizePicker(null)}>
                Cancel
              </button>
              <button className="size-confirm" onClick={confirmShuffle}>
                🎲 Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
