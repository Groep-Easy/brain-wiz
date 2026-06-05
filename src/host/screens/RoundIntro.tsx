import '../styles/round_intro.css'

interface RoundIntroProps {
  index: number
  total: number
}

export function RoundIntro({ index, total }: RoundIntroProps): React.JSX.Element {
  return (
    <main className="round-intro">
      <div className="round-intro-card">
        <p className="round-intro-eyebrow">Get ready…</p>
        <h1 className="round-intro-title">
          Question {index} of {total}
        </h1>
      </div>
    </main>
  )
}
