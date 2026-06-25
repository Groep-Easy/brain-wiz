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
import {
  PALETTE,
  MIN_FLOW_BLOCKS,
  MAX_FLOW_BLOCKS,
  MAX_FLOW_COLUMNS,
  DEFAULT_FLOW_SIZE,
  DEFAULT_QUESTIONS_PER_BLOCK,
  MIN_QUESTIONS_PER_BLOCK,
  MAX_QUESTIONS_PER_BLOCK,
  MINIGAME_TIME_STEP_SECONDS,
  blockById,
  clampMinigameTimeSeconds,
  createFlowItem,
  randomFlowFrom,
} from '../flow/palette'
import { fetchCatalog, storeRoomFlow } from '../flow/flow-api'
import type { BlockDef, FlowItem } from '../flow/types'
import type { ArrowDir, SerpentineCell } from '../flow/serpentine'
import type { CanvasCellHandlers, DropPayload } from './FlowEditor.types'
import {
  insertBlock,
  moveBlock,
  removeBlockAt,
  setBlockMinigameTime,
  setBlockQuestions,
} from '../flow/flowMutations'
import { buildSerpentine } from '../flow/serpentine'
import { WizardLogo } from '@brain-wiz/shared/components/WizardLogo'
import { BlockIcon } from '../components/BlockIcon'
import '../styles/flow_editor.css'

import { playSound, sounds } from '@brain-wiz/shared/SFX/SFX'
import { isMuted } from '@brain-wiz/shared/SFX/mute'

export interface FlowEditorProps {
  initialFlow: FlowItem[]
  roomCode: string
  hostToken: string
}

/** Play a sound effect only when audio is not muted. */
function playIfUnmuted(sound: string): void {
  if (!isMuted()) playSound(sound, false)
}

/** Parse a drop event's DataTransfer into a typed payload descriptor. */
function readDropPayload(dataTransfer: DataTransfer): DropPayload {
  const source = dataTransfer.getData('application/x-source')
  if (source === 'palette') {
    return { source: 'palette', blockId: dataTransfer.getData('application/x-block') }
  }
  if (source === 'flow') {
    return { source: 'flow', from: Number(dataTransfer.getData('application/x-index')) }
  }
  return { source: 'none' }
}

/** The glyph used to render a serpentine arrow direction. */
function arrowGlyph(arrow: ArrowDir): string {
  if (arrow === 'down') return '↓'
  if (arrow === 'left') return '←'
  return '→'
}

/**
 * Snake-path placement classes for a cell's drop indicators. `beforeClass` shows
 * where a block inserted *before this one* lands; `endClass` (drawn on the last
 * flow block) shows where an appended block lands. At a snake turn the gap is
 * vertical (above/below); within a row it's a bar whose side follows flow.
 */
function dropIndicatorClasses(
  cell: SerpentineCell,
  count: number
): { beforeClass: string; endClass: string } {
  const f = cell.logicalIndex
  const beforeClass =
    f === 0
      ? 'start'
      : f % MAX_FLOW_COLUMNS === 0
        ? 'above'
        : cell.row % 2 === 0
          ? 'before'
          : 'after'
  const endClass =
    count % MAX_FLOW_COLUMNS === 0 ? 'below' : cell.row % 2 === 0 ? 'after' : 'before'
  return { beforeClass, endClass }
}

/** The +/- time stepper shown on placed mini-game blocks. */
function MinigameTimeControl({
  label,
  timeLimitSeconds,
  onChange,
}: {
  label: string
  timeLimitSeconds: number
  onChange: (value: number) => void
}): React.JSX.Element {
  return (
    <div
      className="minigame-time-control"
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="time-step"
        onClick={(e) => {
          e.stopPropagation()
          onChange(timeLimitSeconds - MINIGAME_TIME_STEP_SECONDS)
        }}
        aria-label={`Reduce ${label} time by ${MINIGAME_TIME_STEP_SECONDS} seconds`}
        title={`-${MINIGAME_TIME_STEP_SECONDS}s`}
      >
        &lt;
      </button>
      <span className="time-value" aria-label={`${timeLimitSeconds} seconds`}>
        {timeLimitSeconds}s
      </span>
      <button
        type="button"
        className="time-step"
        onClick={(e) => {
          e.stopPropagation()
          onChange(timeLimitSeconds + MINIGAME_TIME_STEP_SECONDS)
        }}
        aria-label={`Increase ${label} time by ${MINIGAME_TIME_STEP_SECONDS} seconds`}
        title={`+${MINIGAME_TIME_STEP_SECONDS}s`}
      >
        &gt;
      </button>
    </div>
  )
}

/** The question-count popover shown for quiz (theme) blocks when opened. */
function BlockSettings({
  uid,
  questions,
  onChange,
  onClose,
}: {
  uid: string
  questions: number
  onChange: (value: number) => void
  onClose: () => void
}): React.JSX.Element {
  return (
    <div className="block-settings">
      <label htmlFor={`questions-${uid}`}>Questions</label>
      <input
        id={`questions-${uid}`}
        type="number"
        min={MIN_QUESTIONS_PER_BLOCK}
        max={MAX_QUESTIONS_PER_BLOCK}
        value={questions}
        autoFocus
        onChange={(e) => onChange(Number(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Escape') onClose()
        }}
      />
    </div>
  )
}

/** The draggable card for a placed block: remove button, icon, and per-kind controls. */
function CanvasBlock({
  cell,
  item,
  block,
  settingsOpen,
  atMinimum,
  handlers,
}: {
  cell: SerpentineCell
  item: FlowItem
  block: BlockDef
  settingsOpen: boolean
  atMinimum: boolean
  handlers: CanvasCellHandlers
}): React.JSX.Element {
  const timeLimitSeconds = clampMinigameTimeSeconds(item.timeLimitSeconds, item.blockId)
  return (
    <div
      className={`canvas-block ${block.kind} ${
        block.kind === 'minigame' ? 'has-time-control' : ''
      }`}
      draggable
      onDragStart={(e) => handlers.onFlowDragStart(e, cell.logicalIndex)}
    >
      <button
        className="remove-block"
        onClick={() => handlers.removeAt(cell.logicalIndex)}
        disabled={atMinimum}
        aria-label={`Remove ${block.label}`}
        title={atMinimum ? `Minimum ${MIN_FLOW_BLOCKS} blocks` : 'Remove from flow'}
      >
        ×
      </button>
      {/* Quiz (theme) blocks let the host set how many questions they contribute. */}
      {block.kind === 'theme' && (
        <button
          className={`settings-btn ${settingsOpen ? 'open' : ''}`}
          draggable={false}
          onClick={(e) => {
            e.stopPropagation()
            handlers.toggleSettings(item.uid)
          }}
          aria-label={`Question count for ${block.label}`}
          title="Number of questions"
        >
          ⚙
        </button>
      )}
      <BlockIcon icon={block.icon} label={block.label} />
      <span className="block-label">{block.label}</span>
      {block.kind === 'minigame' && (
        <MinigameTimeControl
          label={block.label}
          timeLimitSeconds={timeLimitSeconds}
          onChange={(value) => handlers.setMinigameTime(item.uid, item.blockId, value)}
        />
      )}
    </div>
  )
}

/** A single placed block within the snake grid, with its drop indicators and controls. */
function CanvasCell({
  cell,
  item,
  block,
  count,
  dropIndex,
  settingsOpen,
  atMinimum,
  handlers,
}: {
  cell: SerpentineCell
  item: FlowItem
  block: BlockDef
  count: number
  dropIndex: number | null
  settingsOpen: boolean
  atMinimum: boolean
  handlers: CanvasCellHandlers
}): React.JSX.Element {
  const f = cell.logicalIndex
  const isLastInFlow = f === count - 1
  const { beforeClass, endClass } = dropIndicatorClasses(cell, count)
  return (
    <div
      className="canvas-cell"
      style={{ gridRow: cell.row + 1, gridColumn: cell.col }}
    >
      {dropIndex === f && dropIndex < count && (
        <div className={`drop-indicator ${beforeClass}`} />
      )}
      {isLastInFlow && dropIndex === count && (
        <div className={`drop-indicator ${endClass}`} />
      )}
      <CanvasBlock
        cell={cell}
        item={item}
        block={block}
        settingsOpen={settingsOpen}
        atMinimum={atMinimum}
        handlers={handlers}
      />
      {cell.arrow !== 'none' && (
        <span className={`canvas-arrow arrow-${cell.arrow}`} aria-hidden="true">
          {arrowGlyph(cell.arrow)}
        </span>
      )}
      {block.kind === 'theme' && settingsOpen && (
        <BlockSettings
          uid={item.uid}
          questions={item.questions ?? DEFAULT_QUESTIONS_PER_BLOCK}
          onChange={(value) => handlers.setQuestions(item.uid, value)}
          onClose={handlers.closeSettings}
        />
      )}
    </div>
  )
}

export function FlowEditor({
  initialFlow,
  roomCode,
  hostToken,
}: FlowEditorProps): React.JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null)
  const [flow, setFlow] = useState<FlowItem[]>(initialFlow)
  const [catalog, setCatalog] = useState<BlockDef[]>(PALETTE)
  // The slot index a dragged block would be inserted at, or null when not dragging.
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  // Size picker shown when the host asks for a randomized flow.
  const [sizePicker, setSizePicker] = useState<number | null>(null)

  // ── Autosave ──────────────────────────────────────────────────────────────
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const isFirstRender = useRef(true)

  useEffect(() => {
    // Skip saving on the initial mount — the flow hasn't changed yet.
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    setSaveStatus('saving')
    const timer = setTimeout(async () => {
      const ok = await storeRoomFlow(roomCode, hostToken, flow)
      setSaveStatus(ok ? 'saved' : 'error')
      // Clear the indicator after 2s so it doesn't clutter the UI.
      setTimeout(() => setSaveStatus('idle'), 2000)
    }, 800)
    return () => clearTimeout(timer)
  }, [flow, roomCode, hostToken])

  // The uid of the quiz block whose question-count popover is open, if any.
  const [settingsFor, setSettingsFor] = useState<string | null>(null)

  // Set how many questions a quiz block contributes, clamped to the allowed range.
  const setQuestions = (uid: string, value: number) => {
    setFlow((prev) => setBlockQuestions(prev, uid, value))
  }

  const setMinigameTime = (uid: string, blockId: string, value: number) => {
    setFlow((prev) => setBlockMinigameTime(prev, uid, blockId, value))
  }

  // The snake grid: cells in visual (reading) order. A fixed MAX_FLOW_COLUMNS
  // means a full flow lands as exact rows.
  const { cells, count } = useMemo(
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
      return pick ? [...prev, createFlowItem(pick)] : prev
    })
    playIfUnmuted(sounds.cardDrop)
  }

  useEffect(() => {
    let active = true
    void (async () => {
      const blocks = await fetchCatalog()
      if (!active) return
      setCatalog(blocks)

      // If initialFlow is empty, generate a random one locally for the draft
      if (initialFlow.length < MIN_FLOW_BLOCKS) {
        setFlow(randomFlowFrom(blocks, DEFAULT_FLOW_SIZE))
      }
    })()
    return () => {
      active = false
    }
  }, [initialFlow])

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
    playIfUnmuted(sounds.waterDrop)
    e.dataTransfer.setData('application/x-source', 'palette')
    e.dataTransfer.setData('application/x-block', blockId)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const onFlowDragStart = (e: React.DragEvent, index: number) => {
    playIfUnmuted(sounds.waterDrop)
    e.dataTransfer.setData('application/x-source', 'flow')
    e.dataTransfer.setData('application/x-index', String(index))
    e.dataTransfer.effectAllowed = 'move'
  }

  // --- Whole-canvas drop target ------------------------------------------
  // Work out the flow-order insertion index the cursor is over. We walk the
  // blocks in flow order along the snake path: a later row sits lower (Y), and
  // within a row the path runs left-to-right on even rows and right-to-left on
  // odd ones, so the "before this block" test flips per row direction.
  const computeDropIndex = (clientX: number, clientY: number): number => {
    const track = trackRef.current
    if (!track) return flow.length
    // `.canvas-block`s come back in visual order (== `cells`); index their
    // rects by flow position so we can scan the snake in flow order.
    const blocks = Array.from(track.querySelectorAll<HTMLElement>('.canvas-block'))
    const rectByLogical: (DOMRect | undefined)[] = []
    cells.forEach((cell, i) => {
      const el = blocks[i]
      if (el) rectByLogical[cell.logicalIndex] = el.getBoundingClientRect()
    })
    for (let j = 0; j < flow.length; j++) {
      const rect = rectByLogical[j]
      if (!rect) continue
      if (clientY < rect.top) return j // cursor sits in an earlier row ⇒ before j
      if (clientY <= rect.bottom) {
        const mid = rect.left + rect.width / 2
        const isEvenRow = Math.floor(j / MAX_FLOW_COLUMNS) % 2 === 0
        const isBefore = isEvenRow ? clientX < mid : clientX > mid
        if (isBefore) return j
      }
    }
    return flow.length
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

  const applyPaletteDrop = (blockId: string, index: number) => {
    const block = resolveBlock(blockId)
    if (!block) return
    setFlow((prev) => insertBlock(prev, index, block))
  }

  const applyFlowDrop = (from: number, index: number) => {
    if (Number.isNaN(from)) return
    setFlow((prev) => moveBlock(prev, from, index))
  }

  const onCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const index = computeDropIndex(e.clientX, e.clientY)
    setDropIndex(null)
    const payload = readDropPayload(e.dataTransfer)

    if (payload.source === 'palette') {
      applyPaletteDrop(payload.blockId, index)
    } else if (payload.source === 'flow') {
      applyFlowDrop(payload.from, index)
    }
    playIfUnmuted(sounds.cardDrop)
  }

  const removeAt = (index: number) => {
    setFlow((prev) => removeBlockAt(prev, index))
  }

  const toggleSettings = (uid: string) => {
    setSettingsFor((cur) => (cur === uid ? null : uid))
  }

  const closeSettings = () => setSettingsFor(null)

  const openSizePicker = () => {
    setSizePicker(flow.length || DEFAULT_FLOW_SIZE)
  }

  const confirmShuffle = () => {
    if (sizePicker === null) return
    const count = Math.min(MAX_FLOW_BLOCKS, Math.max(MIN_FLOW_BLOCKS, sizePicker))
    setSizePicker(null)
    setFlow(randomFlowFrom(catalog, count))
    playIfUnmuted(sounds.die)
  }

  const atMinimum = flow.length <= MIN_FLOW_BLOCKS

  const cellHandlers: CanvasCellHandlers = {
    onFlowDragStart,
    removeAt,
    toggleSettings,
    setMinigameTime,
    setQuestions,
    closeSettings,
  }

  return (
    <div className="flow-editor">
      <header className="flow-editor-header">
        <WizardLogo size={40} className="brand-logo" />
        <h2>Edit Game Flow</h2>
        <div className="flow-editor-actions">
          <button className="shuffle-btn" onClick={openSizePicker} title="Generate a random flow">
            🎲 Randomize
          </button>
          {saveStatus === 'saving' && <span className="flow-save-status">Saving…</span>}
          {saveStatus === 'saved' && (
            <span className="flow-save-status flow-save-status--ok">Saved ✓</span>
          )}
          {saveStatus === 'error' && (
            <span className="flow-save-status flow-save-status--err">Save failed</span>
          )}
        </div>
      </header>

      <p className="flow-editor-hint">
        Drag themes and mini-games into the flow. Drag blocks to reorder them. Minimum{' '}
        {MIN_FLOW_BLOCKS} blocks.
      </p>

      <div className="flow-editor-body">
        {/* Palette */}
        <aside className="palette">
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
                  <BlockIcon icon={block.icon} label={block.label} />
                  <span className="block-label">{block.label}</span>
                </div>
              ))}
          </div>

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
                  <BlockIcon icon={block.icon} label={block.label} />
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
              return (
                <CanvasCell
                  key={item.uid}
                  cell={cell}
                  item={item}
                  block={block}
                  count={count}
                  dropIndex={dropIndex}
                  settingsOpen={settingsFor === item.uid}
                  atMinimum={atMinimum}
                  handlers={cellHandlers}
                />
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
              onChange={(e) => setSizePicker(Math.min(MAX_FLOW_BLOCKS, Number(e.target.value)))}
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
