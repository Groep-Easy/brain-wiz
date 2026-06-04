import { LoadingComp } from "./components/LoadingComp"
import { JoinScreen } from "./components/JoinScreen"
import { useState } from 'react'
import { useRef } from 'react'
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
  const socket = useRef(new WebSocket("ws://localhost:3000"))
  let playerId = useRef(null)
  let reconnectToken = useRef(null)

  socket.current.onmessage = (e) => {
    const { event, data } = JSON.parse(e.data)
    switch (event) {
      case "PLAYER_JOIN_ACK":
        setState("waiting")
        playerId.current = data.playerId
        reconnectToken.current = data.reconnectToken
        break
      case "PLAYER_JOIN_REJECTED":
        setState("enter-code")
        alert(data.reason)
        break
      case "ROOM_STATE_UPDATE":
        break
    }
  }

  function handleJoin() {
    var player_name = document.getElementById("name").value
    var room_code = document.getElementById("room").value

    if (player_name && room_code) {
      socket.current.send(
        JSON.stringify({
          event: "PLAYER_JOIN",
          data: {
            roomCode: room_code,
            playerName: player_name
          }
        })
      )
      setState("joining")
    }
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
