/**
 * @file clientSocketReducer.ts
 * @description Pure state machine for the client WebSocket. It translates inbound
 * server events and local UI actions into the next state. No sockets, timers, or
 * browser/storage access live here, so the whole thing is unit-testable in
 * isolation; the hook wires it to a real socket and persists credentials.
 */
import * as EVENTS from '@brain-wiz/shared/constants/socket-events.constants'
import type {
  AnswerAckPayload,
  GameOverPayload,
  GamePhaseChangePayload,
  LeaderboardShowPayload,
  PlayerJoinAckPayload,
  PlayerJoinRejectedPayload,
  QuestionRevealPayload,
  QuestionShowPayload,
  RoomState,
  RoundContentPayload,
  RoundFeedbackPayload,
  RoundRevealPayload,
  RoundStartPayload,
  TimerTickPayload,
} from '@brain-wiz/shared/types/index'
import type { SavedPlayer } from '../App.interfaces'
import type {
  ActionHandlerMap,
  ClientSocketAction,
  ClientSocketState,
  ServerEventHandler,
} from './clientSocketReducer.interfaces'

export function createInitialClientState(saved: SavedPlayer | null): ClientSocketState {
  return {
    status: 'connecting',
    joined: false,
    joining: saved !== null,
    roomState: null,
    round: null,
    question: null,
    secondsRemaining: 0,
    selectedAnswerId: null,
    reveal: null,
    roundContent: null,
    roundFeedback: null,
    roundReveal: null,
    leaderboard: [],
    finalScores: null,
    joinError: null,
    fatalError: null,
    reconnectExhausted: false,
    roundSubmitted: false,
    selectedOptionId: null,
    kicked: false,
    creds: saved,
    playerId: null,
    pendingJoin: null,
  }
}

const SERVER_EVENT_HANDLERS: Record<string, ServerEventHandler> = {
  [EVENTS.PLAYER_JOIN_ACK]: (state, data) => {
    const ack = data as PlayerJoinAckPayload
    const creds: SavedPlayer = {
      roomCode: ack.roomCode,
      playerName: state.creds?.playerName ?? state.pendingJoin?.name ?? '',
      playerId: ack.playerId,
      playerAvatar: ack.playerAvatar,
      reconnectToken: ack.reconnectToken,
    }
    return {
      ...state,
      playerId: ack.playerId,
      creds,
      pendingJoin: null,
      joinError: null,
      joining: false,
      joined: true,
    }
  },
  [EVENTS.PLAYER_JOIN_REJECTED]: (state, data) => {
    const rejected = data as PlayerJoinRejectedPayload
    const base: ClientSocketState = { ...state, creds: null, joining: false, joined: false }
    if (rejected.reason === 'Room not found') {
      return { ...base, fatalError: 'Room not found or game already started' }
    }
    return { ...base, joinError: rejected.reason || 'Could not join the room.' }
  },
  [EVENTS.PLAYER_KICKED]: (state) => ({
    ...state,
    kicked: true,
    creds: null,
    playerId: null,
    joined: false,
    joining: false,
    roomState: null,
    finalScores: null,
    reconnectExhausted: false,
    joinError: 'You were kicked from the lobby',
  }),
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
    return {
      ...state,
      round: round ?? state.round,
      roundContent: null,
      roundFeedback: null,
      roundReveal: null,
      roundSubmitted: false,
      selectedOptionId: null,
    }
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
      roundFeedback: null,
      roundReveal: null,
      question,
      reveal: null,
      selectedAnswerId: null,
    }
  },
  [EVENTS.ROUND_CONTENT_SHOW]: (state, data) => ({
    ...state,
    roundContent: data as RoundContentPayload,
    roundFeedback: null,
    roundReveal: null,
    roundSubmitted: false,
    selectedOptionId: null,
  }),
  [EVENTS.ROUND_FEEDBACK]: (state, data) => ({
    ...state,
    roundFeedback: data as RoundFeedbackPayload,
  }),
  [EVENTS.QUESTION_REVEAL]: (state, data) => ({
    ...state,
    reveal: data as QuestionRevealPayload,
  }),
  [EVENTS.ROUND_REVEAL]: (state, data) => ({
    ...state,
    roundReveal: data as RoundRevealPayload,
  }),
  [EVENTS.LEADERBOARD_SHOW]: (state, data) => {
    const { leaderboard } = data as LeaderboardShowPayload
    return leaderboard ? { ...state, leaderboard } : state
  },
  [EVENTS.GAME_OVER]: (state, data) => {
    const { finalScores } = data as GameOverPayload
    return finalScores ? { ...state, finalScores } : state
  },
  [EVENTS.ANSWER_ACK]: (state, data) => {
    const ack = data as AnswerAckPayload
    if (!ack.accepted && (ack.reason === 'server-error' || ack.reason === 'invalid-answer')) {
      return { ...state, selectedAnswerId: null, roundSubmitted: false }
    }
    return state
  },
}

function reduceServerEvent(
  state: ClientSocketState,
  event: string,
  data: unknown
): ClientSocketState {
  const handler = SERVER_EVENT_HANDLERS[event]
  return handler ? handler(state, data) : state
}

const ACTION_HANDLERS: ActionHandlerMap = {
  serverEvent: (state, action) => reduceServerEvent(state, action.event, action.data),
  connecting: (state) => ({ ...state, status: 'connecting' }),
  opened: (state) => ({ ...state, status: 'open', reconnectExhausted: false }),
  closed: (state) => ({ ...state, status: 'closed' }),
  reconnectExhausted: (state) => ({ ...state, reconnectExhausted: true }),
  joinStarted: (state) => ({ ...state, joinError: null, joining: true }),
  pendingJoinSet: (state, action) => ({ ...state, pendingJoin: action.pending }),
  answerSelected: (state, action) => ({ ...state, selectedAnswerId: action.answerId }),
  roundSubmitted: (state) => ({ ...state, roundSubmitted: true }),
  optionSelected: (state, action) => ({ ...state, selectedOptionId: action.choiceId }),
  leftRoom: () => ({ ...createInitialClientState(null), status: 'closed' }),
  fatalCleared: (state) => ({ ...state, fatalError: null, joinError: null }),
}

export function clientSocketReducer(
  state: ClientSocketState,
  action: ClientSocketAction
): ClientSocketState {
  const handler = ACTION_HANDLERS[action.type] as (
    state: ClientSocketState,
    action: ClientSocketAction
  ) => ClientSocketState
  return handler ? handler(state, action) : state
}
