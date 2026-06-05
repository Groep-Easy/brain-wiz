import type { QuestionState, PlayerAnswerResult } from '../../shared/types/index'
import '../styles/answer.css'

const SHAPES = ['▲', '◆', '●', '■']
const TILE_CLASSES = ['tile-teal', 'tile-red', 'tile-blue', 'tile-tan']

interface AnswerProps {
  question: QuestionState
  selectedAnswerId: string | null
  phase: 'playing' | 'reveal'
  result: PlayerAnswerResult | null
  correctAnswerIds: string[]
  secondsRemaining: number
  onAnswer: (answerId: string) => void
}

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

  const timerPct =
    question.timeLimit > 0
      ? Math.max(0, Math.min(100, (secondsRemaining / question.timeLimit) * 100))
      : 0

  return (
    <div className="answer-page">
      {revealed ? (
        <RevealBanner result={result} />
      ) : selectedAnswerId !== null ? (
        <div className="answer-status">Locked in! Waiting for other players…</div>
      ) : (
        <div className="answer-timer">
          <div className="answer-timer-bar" style={{ width: `${timerPct}%` }} />
          <span className="answer-timer-label">{secondsRemaining}s</span>
        </div>
      )}

      <div className="answer-grid">
        {question.answers.map((answer, i) => {
          const isSelected = answer.id === selectedAnswerId
          const isCorrect = correctAnswerIds.includes(answer.id)
          const dim = revealed && !isCorrect
          const tileClass = TILE_CLASSES[i] ?? 'tile-teal'
          const shape = SHAPES[i] ?? ''
          return (
            <button
              key={answer.id}
              type="button"
              className={`answer-tile ${tileClass} ${dim ? 'is-dim' : ''} ${
                revealed && isCorrect ? 'is-correct' : ''
              } ${isSelected ? 'is-selected' : ''}`}
              disabled={locked}
              onClick={() => onAnswer(answer.id)}
              aria-label={`Answer ${shape}`}
            >
              <span className="answer-shape">{shape}</span>
              {revealed && isCorrect ? <span className="answer-check">✓</span> : null}
              {isSelected ? <span className="answer-you">You</span> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function RevealBanner({ result }: { result: PlayerAnswerResult | null }): React.JSX.Element {
  if (!result || result.isTimeout || result.answerId === null) {
    return <div className="reveal-banner is-wrong">Time&apos;s up — no answer ⏰</div>
  }
  if (result.isCorrect) {
    return <div className="reveal-banner is-correct">Correct! +{result.pointsAwarded} pts ✓</div>
  }
  return <div className="reveal-banner is-wrong">Not quite ✗</div>
}
