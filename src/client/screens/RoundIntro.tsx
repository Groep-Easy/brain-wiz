interface RoundIntroProps {
  index: number
  total: number
}

export function RoundIntro({ index, total }: RoundIntroProps): React.JSX.Element {
  return (
    <div className="game-card client-card">
      <p className="subtitle">Get ready…</p>
      <h1>
        Question {index}
        {total > 0 ? ` of ${total}` : ''}
      </h1>
    </div>
  )
}
