import '../styles/round_intro.css'
import { playSound, sounds } from '@brain-wiz/shared/SFX/SFX'
import { isMuted } from '@brain-wiz/shared/SFX/mute'

interface RoundIntroProps {
  index: number
  total: number
  questionText?: string
}

export function RoundIntro({ index, total, questionText }: RoundIntroProps): React.JSX.Element {
  if (!isMuted()) playSound(sounds.roundIntro)
  return (
    <main className="round-intro">
      <div className="round-intro-card">
        <p className="round-intro-eyebrow">
          Question {index} of {total}
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
