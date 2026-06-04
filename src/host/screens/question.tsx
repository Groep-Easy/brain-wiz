export function Question() {
  return (
    <main className="host-question-page">
      <div className="top">
        <div className="top-left"><p>#code of game</p></div>
        <div className="top-center">theme</div>
        <div className="top-right">
          <button>Toggle sound</button>
          <button>Settings</button>
        </div>
      </div>
      <div className="question"><h1>What is the highest building in the world?</h1></div>
      <div className="image"><img></img></div>
      <div className="imageanswer"> </div>
      <div className="answers">
        <div className="answer answer1">Answer1</div>
        <div className="answer answer2">Answer2</div>
        <div className="answer answer3">Answer3</div>
        <div className="answer answer4">Answer4</div>
    </div>
      <div className="bottom">
        <p>#amount answers</p>
        <p>countdown timer</p>
      </div>
    </main>
  )
}
