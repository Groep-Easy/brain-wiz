import '../styles/round_intro.css'
import intro from '../../shared/SFX/intro.wav'

interface RoundIntroProps {
  index: number
  total: number
  questionText?: string
}

export function RoundIntro({ index, total, questionText }: RoundIntroProps): React.JSX.Element {
  return (
    <main className="round-intro">
      <audio id="intro-warning" autoPlay src={intro} preload="auto"></audio>
      <div className="round-intro-card">
        <p className="round-intro-eyebrow">
          Question {index + 1} of {total}
        </p>
        {questionText ? (
          <>
            <h1 className="round-intro-question">{questionText}</h1>
            <p className="round-intro-getready">Get ready…</p>
          </>
        ) : (
          <h1 className="round-intro-title">Get ready…</h1>
        )}
      </div>
    </main>
  )
}
