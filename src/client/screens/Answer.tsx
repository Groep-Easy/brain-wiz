import { useEffect } from 'react'
import '../styles/answer.css'
import { FULL_BAR_PERCENT, SHAPES, TILE_CLASSES } from './Answer.constants'
import type {
  AnswerProps,
  AnswerStatusProps,
  AnswerTileProps,
  RevealBannerProps,
} from './Answer.types'

import { isMuted } from '@brain-wiz/shared/SFX/mute'
import { playSound, sounds } from '@brain-wiz/shared/SFX/SFX'

export function Answer({
  question,
  selectedAnswerId,
  phase,
  result,
  correctAnswerIds,
  secondsRemaining,
  onAnswer,
}: AnswerProps): React.JSX.Element {
  const revealed = phase === 'reveal'
  const locked = revealed || selectedAnswerId !== null

  return (
    <div className="answer-page">
      <AnswerStatus
        revealed={revealed}
        result={result}
        selectedAnswerId={selectedAnswerId}
        secondsRemaining={secondsRemaining}
        timeLimit={question.timeLimit}
      />

      <div className="answer-grid">
        {question.answers.map((answer, i) => (
          <AnswerTile
            key={answer.id}
            answer={answer}
            index={i}
            selectedAnswerId={selectedAnswerId}
            correctAnswerIds={correctAnswerIds}
            revealed={revealed}
            locked={locked}
            onAnswer={onAnswer}
          />
        ))}
      </div>
    </div>
  )
}

/** The banner above the grid: reveal result, a "locked in" notice, or the timer. */
function AnswerStatus({
  revealed,
  result,
  selectedAnswerId,
  secondsRemaining,
  timeLimit,
}: AnswerStatusProps): React.JSX.Element {
  if (revealed) {
    return <RevealBanner result={result} />
  }
  if (selectedAnswerId !== null) {
    return <div className="answer-status">Locked in! Waiting for other players…</div>
  }
  const timerPct =
    timeLimit > 0
      ? Math.max(0, Math.min(FULL_BAR_PERCENT, (secondsRemaining / timeLimit) * FULL_BAR_PERCENT))
      : 0
  return (
    <div className="answer-timer">
      <div className="answer-timer-bar" style={{ width: `${timerPct}%` }} />
      <span className="answer-timer-label">{secondsRemaining}s</span>
    </div>
  )
}

/** One answer option button, styled for its selected/correct/dimmed state. */
function AnswerTile({
  answer,
  index,
  selectedAnswerId,
  correctAnswerIds,
  revealed,
  locked,
  onAnswer,
}: AnswerTileProps): React.JSX.Element {
  const isSelected = answer.id === selectedAnswerId
  const isCorrect = correctAnswerIds.includes(answer.id)
  const dim = revealed && !isCorrect
  const tileClass = TILE_CLASSES[index] ?? 'tile-teal'
  const shape = SHAPES[index] ?? ''
  return (
    <button
      type="button"
      className={`answer-tile ${tileClass} ${dim ? 'is-dim' : ''} ${
        revealed && isCorrect ? 'is-correct' : ''
      } ${isSelected ? 'is-selected' : ''}`}
      disabled={locked}
      onClick={() => {
        onAnswer(answer.id)
        playSound(sounds.pop, false)
      }}
      aria-label={`Answer ${shape}`}
    >
      <span className="answer-shape">{shape}</span>
      {revealed && isCorrect ? <span className="answer-check">✓</span> : null}
      {isSelected ? <span className="answer-you">You</span> : null}
    </button>
  )
}

function RevealBanner({ result }: RevealBannerProps): React.JSX.Element {
  useEffect(() => {
    if (!isMuted()) {
      if (!result || result.isTimeout || result.answerId === null) playSound(sounds.wrong, false)
      if (result?.isCorrect) playSound(sounds.correct, false)
      else playSound(sounds.wrong, false)
    }
  }, [result])

  if (!result || result.isTimeout || result.answerId === null) {
    return <div className="reveal-banner is-wrong">Time&apos;s up — no answer ⏰</div>
  }
  if (result.isCorrect) {
    return <div className="reveal-banner is-correct">Correct! +{result.pointsAwarded} pts ✓</div>
  }
  return <div className="reveal-banner is-wrong">Not quite ✗</div>
}
