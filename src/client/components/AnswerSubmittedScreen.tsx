import '../styles/AnswerSubmittedScreen.css'

type Props = {
  answer: string | null
}

export function AnswerSubmittedScreen({ answer }: Props) {
  return (
    <div className="as-container">
      <div className="as-check">✓</div>

      <h2 className="as-title">Answer locked in!</h2>

      <p className="as-subtitle">You submitted:</p>

      <div className="as-answer">{answer}</div>

      <p className="as-waiting">
        Waiting for other players
        <span className="dots">
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </p>
    </div>
  )
}
