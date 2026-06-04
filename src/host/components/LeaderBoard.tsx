/**
 * @file LeaderBoard.tsx
 * @owner host-squad
 * @description Root component for the host display (served at /). This is the
 * host team's page. The server team's WebSocket debug console lives separately
 * at /console (see console/Console.tsx) so the two don't collide.
 */
import { useState, useRef, useLayoutEffect } from 'react'
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

  const itemRefs = useRef<Map<string, HTMLLIElement>>(new Map())
  const previousPositions = useRef<Map<string, number>>(new Map())

  useLayoutEffect(() => {
    const currentPositions = new Map<string, number>()

    itemRefs.current.forEach((el, name) => {
      currentPositions.set(name, el.getBoundingClientRect().top)
    })

    itemRefs.current.forEach((el, name) => {
      const previousTop = previousPositions.current.get(name)
      const currentTop = currentPositions.get(name)

      if (previousTop !== undefined && currentTop !== undefined) {
        const deltaY = previousTop - currentTop

        if (deltaY !== 0) {
          el.style.transition = 'none'
          el.style.transform = `translateY(${deltaY}px)`

          requestAnimationFrame(() => {
            el.style.transition = 'transform 800ms ease'
            el.style.transform = ''
          })
        }
      }
    })

    previousPositions.current = currentPositions
  }, [players])

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
      <ul>
        {sortedPlayers.map((player, index) => (
          <li
            key={player.name}
            ref={(el) => {
              if (el) {
                itemRefs.current.set(player.name, el)
              } else {
                itemRefs.current.delete(player.name)
              }
            }}
            className={`player ${index === 0 ? 'first' : ''}`}
          >
            <span className="name">{player.name}</span>
            <span className="score">{player.score}</span>
          </li>
        ))}
      </ul>

      <button onClick={updateScores}>Update Scores</button>
    </>
  )
}
