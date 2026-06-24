/**
 * @file flow.types.ts
 * @description Server-internal types for building game flows. Wire types shared
 * with the host live in `@brain-wiz/shared/types/flow`.
 */
import type { GameBlockDto } from '@brain-wiz/shared/types/flow'

export interface FlowItemInput {
  blockId: string
  kind: GameBlockDto['kind']
  available: number | undefined
  requestedQuestions: number | undefined
  requestedTimeLimitSeconds: number | undefined
}
