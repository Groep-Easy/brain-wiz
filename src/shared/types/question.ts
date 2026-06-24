/**
 * @file types/question.ts
 * @description The quiz/question round: its content, submissions, and reveal.
 */

export interface QuestionState {
  id: string
  text: string
  answers: Answer[]
  timeLimit: number
}

export interface Answer {
  id: string
  text: string
}

/** Server → all: question is live (QUESTION_SHOW). */
export interface QuestionShowPayload {
  question: QuestionState
}

/** Client → server: submit an answer (ANSWER_SUBMIT). */
export interface AnswerSubmitPayload {
  answerId: string
  timestamp: number
}

/** Server → client: answer outcome (ANSWER_ACK). */
export interface AnswerAckPayload {
  received: true
  accepted: boolean
  reason?: 'window-closed' | 'invalid-answer' | 'already-answered' | 'server-error'
}

/** Server → all: how many connected players have answered (ANSWER_COUNT_UPDATE). */
export interface AnswerCountUpdatePayload {
  answered: number
  total: number
}

/** One player's result inside QUESTION_REVEAL.playerAnswers. */
export interface PlayerAnswerResult {
  answerId: string | null
  isCorrect: boolean
  pointsAwarded: number
  isTimeout: boolean
}

/** Server → all: reveal correctness + scoring (QUESTION_REVEAL). */
export interface QuestionRevealPayload {
  roundId: string
  correctAnswerIds: string[]
  playerAnswers: Record<string /* playerId */, PlayerAnswerResult>
}
