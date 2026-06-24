/**
 * @file socket-events.ts
 * @owner git-master
 * @description Single source of truth for ALL Socket.io event name strings.
 *
 * RULES:
 *  1. Never hardcode an event string anywhere else in the codebase.
 *  2. Names follow CONTEXT_ACTION (screaming snake case).
 *  3. A change here breaks ALL contexts — notify the team before merging.
 */

// ── Room lifecycle ────────────────────────────────────────────────────────────
/** Server → all:    room state changed.   Payload: { room: RoomState }       */
export const ROOM_STATE_UPDATE = 'ROOM_STATE_UPDATE'
/** Client → server: join request.         Payload: { roomCode, playerName }  */
export const PLAYER_JOIN = 'PLAYER_JOIN'
/** Server → client: join accepted.        Payload: { playerId, roomCode }    */
export const PLAYER_JOIN_ACK = 'PLAYER_JOIN_ACK'
/** Server → client: join rejected.        Payload: { reason: string }        */
export const PLAYER_JOIN_REJECTED = 'PLAYER_JOIN_REJECTED'
/** Host   → server: kicks a player                                           */
export const PLAYER_KICKED = 'PLAYER_KICKED'
/** Client → server: deliberate leave.     Payload: none                      */
export const PLAYER_LEAVE = 'PLAYER_LEAVE'
/** Server → all:    unplanned disconnect. Payload: { playerId }              */
export const PLAYER_DISCONNECTED = 'PLAYER_DISCONNECTED'
/** Server → all:    player reconnected.   Payload: { playerId }              */
export const PLAYER_RECONNECTED = 'PLAYER_RECONNECTED'

// ── Game flow ─────────────────────────────────────────────────────────────────
/** Server → all:    game started.         Payload: none                      */
export const GAME_START = 'GAME_START'
/** Server → all:    phase changed.        Payload: { phase: GamePhase }      */
export const GAME_PHASE_CHANGE = 'GAME_PHASE_CHANGE'
/** Server → all:    round started.        Payload: { round: RoundState }     */
export const ROUND_START = 'ROUND_START'
/** Server → all:    round ended.          Payload: { scores: ScoreMap }      */
export const ROUND_END = 'ROUND_END'
/** Server → all:    leaderboard shown.    Payload: { round, leaderboard }    */
export const LEADERBOARD_SHOW = 'LEADERBOARD_SHOW'
/** Server → all:    roadmap shown.        Payload: { roadmap }               */
export const ROADMAP_SHOW = 'ROADMAP_SHOW'
/** Server → all:    game over.            Payload: { finalScores: ScoreMap } */
export const GAME_OVER = 'GAME_OVER'
/** Server → all:    roadmap position.     Payload: RoadmapUpdate             */
export const ROADMAP_UPDATE = 'ROADMAP_UPDATE'

// ── Quiz round ────────────────────────────────────────────────────────────────
/** Server → all:    question live.        Payload: { question: QuestionState }          */
export const QUESTION_SHOW = 'QUESTION_SHOW'
export const ROUND_CONTENT_SHOW = 'ROUND_CONTENT_SHOW'
/** Server → all:    answer reveal.        Payload: { correctAnswer, playerAnswers }     */
export const QUESTION_REVEAL = 'QUESTION_REVEAL'
export const ROUND_REVEAL = 'ROUND_REVEAL'
/** Client → server: submit answer.        Payload: { answerId, timestamp }             */
export const ANSWER_SUBMIT = 'ANSWER_SUBMIT'
export const ROUND_SUBMIT = 'ROUND_SUBMIT'
export const ROUND_PROGRESS = 'ROUND_PROGRESS'
/** Server → client: answer received.      Payload: { received: true }                  */
export const ANSWER_ACK = 'ANSWER_ACK'
/** Server → all:    how many have answered.  Payload: { answered, total }      */
export const ANSWER_COUNT_UPDATE = 'ANSWER_COUNT_UPDATE'

// ── Timer ─────────────────────────────────────────────────────────────────────
/** Server → all:    tick.                 Payload: { secondsRemaining: number } */
export const TIMER_TICK = 'TIMER_TICK'
/** Server → all:    expired.              Payload: none                          */
export const TIMER_EXPIRED = 'TIMER_EXPIRED'
/** Host → server:   skip the current question timer immediately.  Payload: none */
export const HOST_SKIP_TIMER = 'HOST_SKIP_TIMER'

// ── Errors ────────────────────────────────────────────────────────────────────
/** Server → client: an inbound message failed validation. Payload: { message, details? } */
export const VALIDATION_ERROR = 'VALIDATION_ERROR'

// ── Connectivity ────────────────────────────────────────────────────────────────
/** Client → server: liveness probe.       Payload: { t: number }              */
export const PING = 'PING'
/** Server → client: probe response.       Payload: { t, serverTime }          */
export const PONG = 'PONG'
