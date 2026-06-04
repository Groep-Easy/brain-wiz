import { LoadingComp } from "./components/LoadingComp";
import { useState } from 'react'
/**
 * @file App.tsx
 * @owner client-squad
 * @description Root component for the phone client. Placeholder hello-world
 * screen — socket wiring and the join/lobby UI land in a later slice.
 */

type GameState =
  | 'enter-code'
  | 'joining'
  | 'waiting'
  | 'question'
  | 'answered'
  | 'results'

function JoinScreen({ onJoin }: { onJoin: () => void }) {
  return (
    <div className="screen">
      <h2>Join game</h2>
      <button onClick={onJoin}>Join room</button>
    </div>
  )
}

function WaitingScreen() {
  return (
    <div className="screen">
      <h2>Waiting for players...</h2>
    </div>
  )
}

function QuestionScreen({ onAnswer }: { onAnswer: (a: string) => void }) {
  return (
    <div className="screen">
      <h2>Question</h2>
      <button onClick={() => onAnswer('A')}>A</button>
      <button onClick={() => onAnswer('B')}>B</button>
      <button onClick={() => onAnswer('C')}>C</button>
      <button onClick={() => onAnswer('D')}>D</button>
    </div>
  )
}

function AnsweredScreen() {
  return (
    <div className="screen">
      <h2>Answer submitted</h2>
      <p>Waiting for other players...</p>
    </div>
  )
}

function ResultsScreen() {
  return (
    <div className="screen">
      <h2>Game finished</h2>
      <p>Results go here if we can otherwise look at the screen</p>
    </div>
  )
}

export function App(): React.JSX.Element | null {
  const [state, setState] = useState<GameState>('enter-code')

  function handleJoin() {
    setState('joining')

    setTimeout(() => {
      setState('waiting')
    }, 1000)
  }

  function handleAnswer(answer: string) {
    console.log('answered:', answer)
    setState('answered')

    setTimeout(() => {
      setState('waiting')
    }, 2000)
  }

  switch (state) {
    case 'enter-code':
      return (
        <main className="app">
          <h1>Brain Wiz</h1>
          <JoinScreen onJoin={handleJoin} />
        </main>
      )

    case 'joining':
      return (
        <main className="app">
          <LoadingComp />
        </main>
      )

    case 'waiting':
      return (
        <main className="app">
          <WaitingScreen />
        </main>
      )

    case 'question':
      return (
        <main className="app">
          <QuestionScreen onAnswer={handleAnswer} />
        </main>
      )

    case 'answered':
      return (
        <main className="app">
          <AnsweredScreen />
        </main>
      )

    case 'results':
      return (
        <main className="app">
          <ResultsScreen />
        </main>
      )

    default:
      return null
  }
}
