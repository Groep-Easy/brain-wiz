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
import type { ClientSocketAction, ClientSocketState } from './clientSocketReducer.interfaces'

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

function reduceServerEvent(
  state: ClientSocketState,
  event: string,
  data: unknown
): ClientSocketState {
  switch (event) {
    case EVENTS.PLAYER_JOIN_ACK: {
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
    }
    case EVENTS.PLAYER_JOIN_REJECTED: {
      const rejected = data as PlayerJoinRejectedPayload
      const base: ClientSocketState = { ...state, creds: null, joining: false, joined: false }
      if (rejected.reason === 'Room not found') {
        return { ...base, fatalError: 'Room not found or game already started' }
      }
      return { ...base, joinError: rejected.reason || 'Could not join the room.' }
    }
    case EVENTS.PLAYER_KICKED:
      return {
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
      }
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
      return {
        ...state,
        round: round ?? state.round,
        roundContent: null,
        roundFeedback: null,
        roundReveal: null,
        roundSubmitted: false,
        selectedOptionId: null,
      }
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
        roundFeedback: null,
        roundReveal: null,
        question,
        reveal: null,
        selectedAnswerId: null,
      }
    }
    case EVENTS.ROUND_CONTENT_SHOW:
      return {
        ...state,
        roundContent: data as RoundContentPayload,
        roundFeedback: null,
        roundReveal: null,
        roundSubmitted: false,
        selectedOptionId: null,
      }
    case EVENTS.ROUND_FEEDBACK:
      return { ...state, roundFeedback: data as RoundFeedbackPayload }
    case EVENTS.QUESTION_REVEAL:
      return { ...state, reveal: data as QuestionRevealPayload }
    case EVENTS.ROUND_REVEAL:
      return { ...state, roundReveal: data as RoundRevealPayload }
    case EVENTS.LEADERBOARD_SHOW: {
      const { leaderboard } = data as LeaderboardShowPayload
      return leaderboard ? { ...state, leaderboard } : state
    }
    case EVENTS.GAME_OVER: {
      const { finalScores } = data as GameOverPayload
      return finalScores ? { ...state, finalScores } : state
    }
    case EVENTS.ANSWER_ACK: {
      const ack = data as AnswerAckPayload
      if (!ack.accepted && (ack.reason === 'server-error' || ack.reason === 'invalid-answer')) {
        return { ...state, selectedAnswerId: null, roundSubmitted: false }
      }
      return state
    }
    default:
      return state
  }
}

export function clientSocketReducer(
  state: ClientSocketState,
  action: ClientSocketAction
): ClientSocketState {
  switch (action.type) {
    case 'serverEvent':
      return reduceServerEvent(state, action.event, action.data)
    case 'connecting':
      return { ...state, status: 'connecting' }
    case 'opened':
      return { ...state, status: 'open', reconnectExhausted: false }
    case 'closed':
      return { ...state, status: 'closed' }
    case 'reconnectExhausted':
      return { ...state, reconnectExhausted: true }
    case 'joinStarted':
      return { ...state, joinError: null, joining: true }
    case 'pendingJoinSet':
      return { ...state, pendingJoin: action.pending }
    case 'answerSelected':
      return { ...state, selectedAnswerId: action.answerId }
    case 'roundSubmitted':
      return { ...state, roundSubmitted: true }
    case 'optionSelected':
      return { ...state, selectedOptionId: action.choiceId }
    case 'leftRoom':
      return { ...createInitialClientState(null), status: 'closed' }
    case 'fatalCleared':
      return { ...state, fatalError: null, joinError: null }
    default:
      return state
  }
}
