import type { QuestionState, QuestionRevealPayload } from '@brain-wiz/shared/types/index'
import { computeAnswerStats } from '@brain-wiz/shared/utils/answer-stats'
import '../styles/question.css'
import { useEffect } from 'react'

import { isMuted } from '@brain-wiz/shared/SFX/mute'
import { playSound, sounds, stopSound } from '@brain-wiz/shared/SFX/SFX'

const SHAPES = ['▲', '◆', '●', '■']
const TILE_CLASSES = ['tile-teal', 'tile-blue', 'tile-tan', 'tile-red']

interface QuestionScreenProps {
  gameCode: string
  question: QuestionState
  secondsRemaining: number
  answeredCount: number
  totalPlayers: number
  reveal: QuestionRevealPayload | null
  onSkip: () => void
}

export function Question({
  gameCode,
  question,
  secondsRemaining,
  answeredCount,
  totalPlayers,
  reveal,
  onSkip,
}: QuestionScreenProps): React.JSX.Element {
  const timerPct =
    question.timeLimit > 0
      ? Math.max(0, Math.min(100, (secondsRemaining / question.timeLimit) * 100))
      : 0

  const revealed = reveal !== null
  const summary = revealed ? computeAnswerStats(question, reveal) : null
  const stats = summary?.stats ?? null

  useEffect(() => {
    if (!isMuted()) playSound(sounds.suspense, true)
  }, [question])
  if (revealed) {
    stopSound(sounds.suspense)
    if (!isMuted()) playSound(sounds.reveal, false)
  }

  return (
    <main className="host-question-page">
      <header className="hq-top">
        <span className="hq-code">
          Code: <span className="code-pill">{gameCode}</span>
        </span>
        <span className="hq-status">
          {revealed
            ? `${summary?.correctPlayers ?? 0} of ${summary?.totalAnswered ?? 0} got it right`
            : `${answeredCount} / ${totalPlayers} answered`}
        </span>
        {!revealed && (
          <button className="hq-skip-btn" onClick={onSkip} type="button">
            Skip ⏩
          </button>
        )}
      </header>

      {!revealed && (
        <div className="hq-timer">
          <div className="hq-timer-bar" style={{ width: `${timerPct}%` }} />
          <span className="hq-timer-label">{secondsRemaining}s</span>
        </div>
      )}

      <h1 className="hq-question">{question.text}</h1>

      <div className="hq-answers">
        {question.answers.map((answer, i) => {
          const stat = stats?.[i]
          const isCorrect = stat?.correct ?? false
          const dim = revealed && !isCorrect
          return (
            <div
              key={answer.id}
              className={`hq-tile ${TILE_CLASSES[i] ?? 'tile-teal'} ${
                dim ? 'is-dim' : ''
              } ${revealed && isCorrect ? 'is-correct' : ''}`}
            >
              {revealed && (
                <div className="hq-tile-bar" style={{ width: `${(stat?.fraction ?? 0) * 100}%` }} />
              )}
              <span className="hq-tile-shape">{SHAPES[i] ?? ''}</span>
              <span className="hq-tile-text">{answer.text}</span>
              {revealed && <span className="hq-tile-count">{stat?.count ?? 0}</span>}
              {revealed && isCorrect && <span className="hq-tile-check">✓</span>}
            </div>
          )
        })}
      </div>
    </main>
  )
}
