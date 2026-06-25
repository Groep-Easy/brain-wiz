/**
 * @file hostSocketReducer.ts
 * @description Pure state machine for the host WebSocket. It translates inbound
 * server events and connection-lifecycle actions into the next state. No sockets
 * or browser access live here, so it is unit-testable in isolation; the hook
 * wires it to a real socket. The host is a passive display: it only receives.
 */
import * as EVENTS from '@brain-wiz/shared/constants/socket-events.constants'
import type {
  GameOverPayload,
  GamePhaseChangePayload,
  LeaderboardShowPayload,
  QuestionRevealPayload,
  QuestionShowPayload,
  RoadmapUpdate,
  RoomState,
  RoundContentPayload,
  RoundRevealPayload,
  RoundStartPayload,
  TimerTickPayload,
} from '@brain-wiz/shared/types/index'
import type { HostSocketAction, HostSocketState } from './hostSocketReducer.interfaces'
import { HOST_UNAUTHORIZED_CLOSE_CODE } from './hostSocketReducer.constants'

/** Build the starting (disconnected) state. */
export function createInitialHostState(): HostSocketState {
  return {
    status: 'closed',
    fatalError: null,
    roomState: null,
    secondsRemaining: 0,
    question: null,
    reveal: null,
    answeredCount: 0,
    totalPlayers: 0,
    round: null,
    roundContent: null,
    roundReveal: null,
    leaderboard: [],
    roadmap: null,
    finalScores: null,
  }
}

/** The per-game fields wiped when a fresh connection opens. */
function clearedGameState(): Pick<
  HostSocketState,
  | 'question'
  | 'reveal'
  | 'answeredCount'
  | 'totalPlayers'
  | 'round'
  | 'leaderboard'
  | 'roadmap'
  | 'finalScores'
> {
  return {
    question: null,
    reveal: null,
    answeredCount: 0,
    totalPlayers: 0,
    round: null,
    leaderboard: [],
    roadmap: null,
    finalScores: null,
  }
}

function reduceServerEvent(state: HostSocketState, event: string, data: unknown): HostSocketState {
  switch (event) {
    case EVENTS.ROOM_STATE_UPDATE:
      return { ...state, roomState: (data as { room: RoomState }).room }
    case EVENTS.GAME_PHASE_CHANGE: {
      const { phase } = data as GamePhaseChangePayload
      return {
        ...state,
        roomState: state.roomState ? { ...state.roomState, phase } : state.roomState,
      }
    }
    case EVENTS.ROUND_START: {
      const { round } = data as RoundStartPayload
      return { ...state, round: round ?? state.round, roundContent: null, roundReveal: null }
    }
    case EVENTS.TIMER_TICK:
      return { ...state, secondsRemaining: (data as TimerTickPayload).secondsRemaining }
    case EVENTS.QUESTION_SHOW: {
      const { question } = data as QuestionShowPayload
      if (!question) {
        return state
      }
      return {
        ...state,
        roundContent: null,
        roundReveal: null,
        question,
        reveal: null,
        answeredCount: 0,
      }
    }
    case EVENTS.ROUND_CONTENT_SHOW:
      return {
        ...state,
        roundContent: data as RoundContentPayload,
        roundReveal: null,
        answeredCount: 0,
      }
    case EVENTS.ANSWER_COUNT_UPDATE: {
      const counts = data as { answered: number; total: number }
      return { ...state, answeredCount: counts.answered, totalPlayers: counts.total }
    }
    case EVENTS.QUESTION_REVEAL:
      return { ...state, reveal: data as QuestionRevealPayload }
    case EVENTS.ROUND_REVEAL:
      return { ...state, roundReveal: data as RoundRevealPayload }
    case EVENTS.LEADERBOARD_SHOW: {
      const { leaderboard } = data as LeaderboardShowPayload
      return leaderboard ? { ...state, leaderboard } : state
    }
    case EVENTS.ROADMAP_UPDATE:
      return { ...state, roadmap: data as RoadmapUpdate }
    case EVENTS.GAME_OVER: {
      const { finalScores } = data as GameOverPayload
      return finalScores ? { ...state, finalScores } : state
    }
    default:
      return state
  }
}

export function hostSocketReducer(
  state: HostSocketState,
  action: HostSocketAction
): HostSocketState {
  switch (action.type) {
    case 'serverEvent':
      return reduceServerEvent(state, action.event, action.data)
    case 'connecting':
      return { ...state, status: 'connecting' }
    case 'opened':
      return { ...state, status: 'open', ...clearedGameState() }
    case 'closed': {
      const next: HostSocketState = { ...state, status: 'closed', roomState: null }
      if (action.code === HOST_UNAUTHORIZED_CLOSE_CODE) {
        return { ...next, fatalError: 'Room not found or token invalid' }
      }
      return next
    }
    case 'unauthorized':
      return { ...state, fatalError: 'Room taken or unauthorized' }
    default:
      return state
  }
}
