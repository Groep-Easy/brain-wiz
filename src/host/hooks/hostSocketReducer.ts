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
import type {
  HostSocketAction,
  HostSocketState,
  ServerEventHandler,
} from './hostSocketReducer.interfaces'
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

const SERVER_EVENT_HANDLERS: Record<string, ServerEventHandler> = {
  [EVENTS.ROOM_STATE_UPDATE]: (state, data) => ({
    ...state,
    roomState: (data as { room: RoomState }).room,
  }),
  [EVENTS.GAME_PHASE_CHANGE]: (state, data) => {
    const { phase } = data as GamePhaseChangePayload
    return {
      ...state,
      roomState: state.roomState ? { ...state.roomState, phase } : state.roomState,
    }
  },
  [EVENTS.ROUND_START]: (state, data) => {
    const { round } = data as RoundStartPayload
    return { ...state, round: round ?? state.round, roundContent: null, roundReveal: null }
  },
  [EVENTS.TIMER_TICK]: (state, data) => ({
    ...state,
    secondsRemaining: (data as TimerTickPayload).secondsRemaining,
  }),
  [EVENTS.QUESTION_SHOW]: (state, data) => {
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
  },
  [EVENTS.ROUND_CONTENT_SHOW]: (state, data) => ({
    ...state,
    roundContent: data as RoundContentPayload,
    roundReveal: null,
    answeredCount: 0,
  }),
  [EVENTS.ANSWER_COUNT_UPDATE]: (state, data) => {
    const counts = data as { answered: number; total: number }
    return { ...state, answeredCount: counts.answered, totalPlayers: counts.total }
  },
  [EVENTS.QUESTION_REVEAL]: (state, data) => ({ ...state, reveal: data as QuestionRevealPayload }),
  [EVENTS.ROUND_REVEAL]: (state, data) => ({
    ...state,
    roundReveal: data as RoundRevealPayload,
  }),
  [EVENTS.LEADERBOARD_SHOW]: (state, data) => {
    const { leaderboard } = data as LeaderboardShowPayload
    return leaderboard ? { ...state, leaderboard } : state
  },
  [EVENTS.ROADMAP_UPDATE]: (state, data) => ({ ...state, roadmap: data as RoadmapUpdate }),
  [EVENTS.GAME_OVER]: (state, data) => {
    const { finalScores } = data as GameOverPayload
    return finalScores ? { ...state, finalScores } : state
  },
}

function reduceServerEvent(state: HostSocketState, event: string, data: unknown): HostSocketState {
  const handler = SERVER_EVENT_HANDLERS[event]
  return handler ? handler(state, data) : state
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
