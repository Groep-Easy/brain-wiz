/**
 * @file src/shared/types/flow.ts
 * @description Wire types for the game-flow feature, shared by the server (which
 * serves the block catalog and stores/plays flows) and the host (which builds
 * and randomizes them).
 */

export type BlockKindWire = 'theme' | 'minigame'

/** A building block as served by `GET /flow/blocks`. */
export interface GameBlockDto {
  id: string
  kind: BlockKindWire
  label: string
  icon: string
  available?: number
}

/**
 * One block placed in a flow, as stored on a room and sent on the wire. This is
 * the minimal shape the server needs; the host's in-editor `FlowItem` adds a
 * client-only `uid` on top of this.
 */
export interface GameFlowItem {
  blockId: string
  questions?: number
  /** Per-block difficulty for minigames that support it (Bonk Air: 1-3). */
  difficulty?: number
}
