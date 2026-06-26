/**
 * @file hostSocketReducer.interfaces.ts
 * @description Types for the host WebSocket state machine: the reducer state and
 * its actions. See hostSocketReducer.ts for the logic.
 */
import type {
  LeaderboardEntry,
  QuestionRevealPayload,
  QuestionState,
  RoadmapUpdate,
  RoomState,
  RoundContentPayload,
  RoundRevealPayload,
  RoundSummary,
  ScoreMap,
} from '@brain-wiz/shared/types/index'

export type ConnectionStatus = 'closed' | 'connecting' | 'open'

export interface HostSocketState {
  status: ConnectionStatus
  fatalError: string | null
  roomState: RoomState | null
  secondsRemaining: number
  question: QuestionState | null
  reveal: QuestionRevealPayload | null
  answeredCount: number
  totalPlayers: number
  round: RoundSummary | null
  roundContent: RoundContentPayload | null
  roundReveal: RoundRevealPayload | null
  leaderboard: LeaderboardEntry[]
  roadmap: RoadmapUpdate | null
  finalScores: ScoreMap | null
}

export type HostSocketAction =
  | { type: 'serverEvent'; event: string; data: unknown }
  | { type: 'connecting' }
  | { type: 'opened' }
  | { type: 'closed'; code?: number }
  | { type: 'unauthorized' }

export type ServerEventHandler = (state: HostSocketState, data: unknown) => HostSocketState
