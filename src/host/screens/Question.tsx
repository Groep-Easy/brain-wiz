import type { QuestionState, QuestionRevealPayload } from '@brain-wiz/shared/types/index'
import { computeAnswerStats } from '@brain-wiz/shared/utils/answer-stats'
import '../styles/question.css'
import suspenseMusic from '@brain-wiz/shared/SFX/Standoff.mp3'

const SHAPES = ['▲', '◆', '●', '■']
const TILE_CLASSES = ['tile-teal', 'tile-blue', 'tile-tan', 'tile-red']

interface QuestionScreenProps {
  gameCode: string
  question: QuestionState
  secondsRemaining: number
  answeredCount: number
  totalPlayers: number
  reveal: QuestionRevealPayload | null
}

export function Question({
  gameCode,
  question,
  secondsRemaining,
  answeredCount,
  totalPlayers,
  reveal,
}: QuestionScreenProps): React.JSX.Element {
  const timerPct =
    question.timeLimit > 0
      ? Math.max(0, Math.min(100, (secondsRemaining / question.timeLimit) * 100))
      : 0

  const revealed = reveal !== null
  const summary = revealed ? computeAnswerStats(question, reveal) : null
  const stats = summary?.stats ?? null

  return (
    <main className="host-question-page">
      <audio
        id="suspense-music"
        loop
        autoPlay
        src={suspenseMusic}
        preload="auto">
      </audio>
      <header className="hq-top">
        <span className="hq-code">Code: {gameCode}</span>
        <span className="hq-status">
          {revealed
            ? `${summary?.correctPlayers ?? 0} of ${summary?.totalAnswered ?? 0} got it right`
            : `${answeredCount} / ${totalPlayers} answered`}
        </span>
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
