/**
 * @file LeaderBoard.tsx
 * @owner host-squad
 * @description Root component for the host display (served at /). This is the
 * host team's page. The server team's WebSocket debug console lives separately
 * at /console (see console/Console.tsx) so the two don't collide.
 */
import { useState } from 'react'
import '../styles/leaderboard.css'

type Player = {
  name: string
  score: number
}

export function LeaderBoard(): React.JSX.Element {
  const [players, setPlayers] = useState<Player[]>([
    { name: 'Player 1', score: 100 },
    { name: 'Player 2', score: 300 },
    { name: 'Player 3', score: 200 },
  ])

  function updateScores() {
    setPlayers((prev) =>
      prev.map((player) => ({
        ...player,
        score: player.score + Math.floor(Math.random() * 200),
      }))
    )
  }

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score)

  return (
    <>
      <ul id="leaderboard">
        {sortedPlayers.map((player, index) => (
          <li key={player.name} className={`player ${index === 0 ? 'first' : ''}`}>
            <span className="name">{player.name}</span>
            <span className="score">{player.score}</span>
          </li>
        ))}
      </ul>

      <button onClick={updateScores}>Update Scores</button>
    </>
  )
}
