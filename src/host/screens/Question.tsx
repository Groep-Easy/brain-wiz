import '../styles/main_style.css'

interface QuestionProps {
  gameCode: string
  theme: string
  currentQuestion: string
  answers: string[]
  amountAnswers: number
  timer: number
}

export function Question({
  gameCode,
  theme,
  currentQuestion,
  answers,
  amountAnswers,
  timer,
}: QuestionProps): React.JSX.Element {
  return (
    <main className="host-question-page">
      <div className="top">
        <div className="top-left">
          <p>Game code: {gameCode}</p>
        </div>
        <div className="top-center">{theme} Quiz</div>
        <div className="top-right">
          <button>Toggle sound</button>
          <button>Settings</button>
        </div>
      </div>
      <div className="question">
        <h1>{currentQuestion}</h1>
      </div>
      <div className="image">
        <img alt="" />
      </div>
      <div className="imageanswer"> </div>
      <div className="answers">
        {answers[0] && <div className="answer answer1">{answers[0]}</div>}
        {answers[1] && <div className="answer answer2">{answers[1]}</div>}
        {answers[2] && <div className="answer answer3">{answers[2]}</div>}
        {answers[3] && <div className="answer answer4">{answers[3]}</div>}
      </div>
      <div className="bottom">
        <p>Answers: {amountAnswers}</p>
        <p>{timer}s left!</p>
      </div>
    </main>
  )
}
