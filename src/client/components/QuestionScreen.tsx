import type { QuestionState } from '../../shared/types'
import '../styles/QuestionScreen.css'

type Props = {
  question: QuestionState
  onAnswer: (answerId: string, answerText: string) => void
}

export function QuestionScreen({ question, onAnswer }: Props) {
  return (
    <div className="qs-container">
      <h2 className="qs-title">{question.text}</h2>

      <div className="qs-grid">
        {question.answers.map((a) => (
          <button key={a.id} className="qs-answer" onClick={() => onAnswer(a.id, a.text)}>
            {a.text}
          </button>
        ))}
      </div>
    </div>
  )
}
