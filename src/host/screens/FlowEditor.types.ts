/**
 * @file FlowEditor.types.ts
 * @owner host-squad
 * @description UI types for the FlowEditor screen: the parsed drag payload and
 * the callback bundle its canvas cells need. See FlowEditor.tsx for the logic.
 */
import type { DragEvent } from 'react'

/** A parsed drag payload read from a drop's DataTransfer. */
export type DropPayload =
  | { source: 'palette'; blockId: string }
  | { source: 'flow'; from: number }
  | { source: 'none' }

/** Callbacks a CanvasCell needs from the editor. */
export interface CanvasCellHandlers {
  onFlowDragStart: (e: DragEvent, index: number) => void
  removeAt: (index: number) => void
  toggleSettings: (uid: string) => void
  setMinigameTime: (uid: string, blockId: string, value: number) => void
  setQuestions: (uid: string, value: number) => void
  closeSettings: () => void
}
