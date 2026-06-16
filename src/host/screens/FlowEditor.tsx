/**
 * @file FlowEditor.tsx
 * @owner Dajo
 * @description Drag-and-drop editor for building a custom game flow. The host
 * drags theme and mini-game blocks from the palette into the flow canvas, where
 * they can be reordered or removed. The whole canvas is a drop target: the drop
 * position is computed from the cursor, with a live insertion indicator. The
 * flow is persisted to localStorage and the lobby (in another tab) picks up
 * changes via the `storage` event. A flow must keep at least MIN_FLOW_BLOCKS.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
  randomFlowFrom,
  nextUid,
} from '../flow/palette'
import { fetchCatalog, fetchRoomFlow, storeRoomFlow, randomizeRoomFlow } from '../flow/flow-api'
import type { BlockDef, FlowItem } from '../flow/types'
import { buildSerpentine } from '../flow/serpentine'
import brandLogo from '../assets/BrainWiz logo.png'
import '../styles/flow_editor.css'

import useSound from 'use-sound'
import dieSound from '../../shared/SFX/die.mp3'
import dragSound from '../../shared/SFX/water-drop.mp3'
import dropSound from '../../shared/SFX/card-drop.mp3'
import { isMuted } from '../../shared/SFX/mute'

export function FlowEditor(): React.JSX.Element {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const code = searchParams.get('code') ?? ''
  const token = searchParams.get('token') ?? ''
  const serverBacked = code !== '' && token !== ''
  const trackRef = useRef<HTMLDivElement>(null)
  const [flow, setFlow] = useState<FlowItem[]>([])
  const [ready, setReady] = useState(false)
  const skipNextSave = useRef(true)
  const [catalog, setCatalog] = useState<BlockDef[]>(PALETTE)
  // The slot index a dragged block would be inserted at, or null when not dragging.
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  // Size picker shown when the host asks for a randomized flow.
  const [sizePicker, setSizePicker] = useState<number | null>(null)
  // The uid of the quiz block whose question-count popover is open, if any.
  const [settingsFor, setSettingsFor] = useState<string | null>(null)

  const [playDieSound] = useSound(dieSound)
  const [playDragSound] = useSound(dragSound)
  const [playDropSound] = useSound(dropSound)

  // Set how many questions a quiz block contributes, clamped to the allowed range.
  const setQuestions = (uid: string, value: number) => {
    const clamped = Math.min(
      MAX_QUESTIONS_PER_BLOCK,
      Math.max(MIN_QUESTIONS_PER_BLOCK, Math.round(value) || MIN_QUESTIONS_PER_BLOCK)
    )
    setFlow((prev) => prev.map((f) => (f.uid === uid ? { ...f, questions: clamped } : f)))
  }

  // The snake grid: cells in visual order + per-slot logical insert mapping. A
  // fixed MAX_FLOW_COLUMNS means a full flow lands as exact rows.
  const { cells, count, logicalInsertForSlot } = useMemo(
    () => buildSerpentine(flow.length, MAX_FLOW_COLUMNS),
    [flow.length]
  )

  const blockMetaById = useMemo(() => new Map(catalog.map((b) => [b.id, b])), [catalog])
  const resolveBlock = (id: string): BlockDef | undefined => blockMetaById.get(id) ?? blockById(id)

  const addCellPos = useMemo(() => {
    if (flow.length >= MAX_FLOW_BLOCKS) return null
    const withAdd = buildSerpentine(flow.length + 1, MAX_FLOW_COLUMNS)
    return withAdd.cells.find((c) => c.logicalIndex === flow.length) ?? null
  }, [flow.length])

  const addBlock = () => {
    setFlow((prev) => {
      if (prev.length >= MAX_FLOW_BLOCKS) return prev
      const pick = catalog[Math.floor(Math.random() * catalog.length)]
      return pick ? [...prev, { uid: nextUid(), blockId: pick.id }] : prev
    })
    if (!isMuted()) playDropSound()
  }

  useEffect(() => {
    let active = true
    void (async () => {
      const [blocks, serverFlow] = await Promise.all([
        fetchCatalog(),
        serverBacked ? fetchRoomFlow(code) : Promise.resolve<FlowItem[]>([]),
      ])
      if (!active) return
      setCatalog(blocks)
      const initial =
        serverFlow.length >= MIN_FLOW_BLOCKS
          ? serverFlow
          : randomFlowFrom(blocks, DEFAULT_FLOW_SIZE)
      skipNextSave.current = true
      setFlow(initial)
      setReady(true)
    })()
    return () => {
      active = false
    }
  }, [code, serverBacked])

  useEffect(() => {
    if (!ready || !serverBacked) return
    if (skipNextSave.current) {
      skipNextSave.current = false
      return
    }
    const timer = setTimeout(() => {
      void storeRoomFlow(code, token, flow)
    }, 400)
    return () => clearTimeout(timer)
  }, [flow, ready, serverBacked, code, token])

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
    if (!isMuted()) playDragSound()
  }

  const onFlowDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('application/x-source', 'flow')
    e.dataTransfer.setData('application/x-index', String(index))
    e.dataTransfer.effectAllowed = 'move'
    if (!isMuted()) playDragSound()
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
      if (!resolveBlock(blockId)) return
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
    if (!isMuted()) playDropSound()
  }

  const removeAt = (index: number) => {
    setFlow((prev) => (prev.length <= MIN_FLOW_BLOCKS ? prev : prev.filter((_, i) => i !== index)))
  }

  const openSizePicker = () => {
    setSizePicker(flow.length || DEFAULT_FLOW_SIZE)
  }

  const confirmShuffle = () => {
    if (sizePicker === null) return
    const count = Math.min(MAX_FLOW_BLOCKS, Math.max(MIN_FLOW_BLOCKS, sizePicker))
    setSizePicker(null)
    if (serverBacked) {
      void randomizeRoomFlow(code, token, count)
      .then((next) => {
          skipNextSave.current = true
          setFlow(next)
        })
        .catch(() => setFlow(randomFlowFrom(catalog, count)))
      } else {
        setFlow(randomFlowFrom(catalog, count))
      }
    if (!isMuted()) playDieSound()
  }

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
        <img className="brand-logo" src={brandLogo} alt="BrainWiz" />
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
            {catalog
              .filter((b) => b.kind === 'theme')
              .map((block) => (
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
            {catalog
              .filter((b) => b.kind === 'minigame')
              .map((block) => (
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
              const block = resolveBlock(item.blockId)
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
            {addCellPos && (
              <div
                className="canvas-cell"
                key="canvas-add"
                style={{ gridRow: addCellPos.row + 1, gridColumn: addCellPos.col }}
              >
                <button
                  type="button"
                  className="canvas-add"
                  onClick={addBlock}
                  title="Add a block"
                  aria-label="Add a block"
                >
                  +
                </button>
              </div>
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
