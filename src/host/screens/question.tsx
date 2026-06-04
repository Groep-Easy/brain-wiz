export function Question() {
  const gameCode = "12345"
  const theme = "Geography"
  const currentQuestion = "What is the highest building in the world?"
  const answers = ["Burj Khalifa", "Taipei 101", "One World Trade Center", "woidjiew"]
  var amountAnswers = 5
  var timer = 29
  return (
    <main className="host-question-page">
      <div className="top">
        <div className="top-left"><p>Game code: {gameCode}</p></div>
        <div className="top-center">{theme} quiz</div>
        <div className="top-right">
          <button>Toggle sound</button>
          <button>Settings</button>
        </div>
      </div>
      <div className="question"><h1>{currentQuestion}</h1></div>
      <div className="image"><img></img></div>
      <div className="imageanswer"> </div>
      <div className="answers">
        <div className="answer answer1">{answers[0]}</div>
        <div className="answer answer2">{answers[1]}</div>
        <div className="answer answer3">{answers[2]}</div>
        <div className="answer answer4">{answers[3]}</div>
    </div>
      <div className="bottom">
        <p>{amountAnswers}</p>
        <p>{timer}s left!</p>
      </div>
    </main>
  )
}
