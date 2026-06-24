/**
 * @file clientSocketReducer.interfaces.ts
 * @description Types for the client WebSocket state machine: the reducer state,
 * its actions, and supporting shapes. See clientSocketReducer.ts for the logic.
 */
import type {
  LeaderboardEntry,
  PlayerAvatar,
  QuestionRevealPayload,
  QuestionState,
  RoomState,
  RoundContentPayload,
  RoundFeedbackPayload,
  RoundRevealPayload,
  RoundSummary,
  ScoreMap,
} from '@brain-wiz/shared/types/index'
import type { SavedPlayer } from '../App.interfaces'

export type ConnectionStatus = 'connecting' | 'open' | 'closed'

export interface PendingJoin {
  name: string
  code: string
  playerAvatar: PlayerAvatar
}

export interface ClientSocketState {
  status: ConnectionStatus
  joined: boolean
  joining: boolean
  roomState: RoomState | null
  round: RoundSummary | null
  question: QuestionState | null
  secondsRemaining: number
  selectedAnswerId: string | null
  reveal: QuestionRevealPayload | null
  roundContent: RoundContentPayload | null
  roundFeedback: RoundFeedbackPayload | null
  roundReveal: RoundRevealPayload | null
  leaderboard: LeaderboardEntry[]
  finalScores: ScoreMap | null
  joinError: string | null
  fatalError: string | null
  reconnectExhausted: boolean
  roundSubmitted: boolean
  selectedOptionId: string | null
  kicked: boolean
  creds: SavedPlayer | null
  playerId: string | null
  pendingJoin: PendingJoin | null
}

export type ClientSocketAction =
  | { type: 'serverEvent'; event: string; data: unknown }
  | { type: 'connecting' }
  | { type: 'opened' }
  | { type: 'closed' }
  | { type: 'reconnectExhausted' }
  | { type: 'joinStarted' }
  | { type: 'pendingJoinSet'; pending: PendingJoin }
  | { type: 'answerSelected'; answerId: string }
  | { type: 'roundSubmitted' }
  | { type: 'optionSelected'; choiceId: string }
  | { type: 'leftRoom' }
  | { type: 'fatalCleared' }
