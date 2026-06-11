import type {
  RoundAnswerChoice,
  RoundContentPayload,
  RoundSubmitPayload,
} from '../shared/types/index.js'

export function getRoundAnswerChoices(content: RoundContentPayload): RoundAnswerChoice[] {
  return content.answerChoices ?? []
}

export function createRoundSubmitPayload(
  content: RoundContentPayload,
  submission: unknown,
  timestamp = Date.now()
): RoundSubmitPayload {
  return {
    roundId: content.roundId,
    type: content.type,
    submission,
    timestamp,
  }
}

export function createRoundChoiceSubmitPayload(
  content: RoundContentPayload,
  choice: RoundAnswerChoice,
  timestamp = Date.now()
): RoundSubmitPayload {
  return createRoundSubmitPayload(content, choice.submission, timestamp)
}
