/**
 * @file LeaderBoard.tsx
 * @owner host-squad
 * @description Renders the leaderboard screen for the host, showing ranks and
 * score changes with layout animations.
 */
import { useRef, useLayoutEffect } from 'react'
import type { LeaderboardEntry } from '../../shared/types/index'
import '../styles/leaderboard.css'

interface LeaderBoardProps {
  leaderboard: LeaderboardEntry[]
}

export function LeaderBoard({ leaderboard }: LeaderBoardProps): React.JSX.Element {
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
  }, [leaderboard])

  return (
    <div className="leaderboard-screen">
      <header className="leaderboard-header">
        <h1>Leaderboard</h1>
      </header>
      <ul className="leaderboard-list">
        {leaderboard.map((entry, index) => (
          <li
            key={entry.playerId}
            ref={(el) => {
              if (el) {
                itemRefs.current.set(entry.name, el)
              } else {
                itemRefs.current.delete(entry.name)
              }
            }}
            className={`player-row ${index === 0 ? 'first-place' : ''}`}
          >
            <div className="player-info">
              <span className="rank">#{entry.rank}</span>
              <span className="name">{entry.name}</span>
            </div>
            <div className="player-stats">
              <span className="score">{entry.score} pts</span>
              {entry.rankChange !== 0 && (
                <span className={`rank-change ${entry.rankChange > 0 ? 'rank-up' : 'rank-down'}`}>
                  {entry.rankChange > 0 ? `▲ ${entry.rankChange}` : `▼ ${Math.abs(entry.rankChange)}`}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
