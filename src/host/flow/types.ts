/**
 * @file types.ts
 * @owner host-squad
 * @description Type definitions for the host game-flow feature: the building
 * blocks a host can place, an editor flow item, and its server-stored shape.
 */

export type BlockKind = 'theme' | 'minigame'

/** A building block in the palette (a trivia theme or a mini-game). */
export interface BlockDef {
  id: string
  label: string
  kind: BlockKind
  icon: string
}

/** A single block placed in a flow. `uid` is a per-instance id (a block type may appear twice). */
export interface FlowItem {
  uid: string
  blockId: string
  /** How many questions a quiz (theme) block contributes. Undefined = default. */
  questions?: number
}

/** A flow item as stored on the server (no client-only `uid`). */
export interface StoredFlowItem {
  blockId: string
  questions?: number
}
