/**
 * @file LeaderBoard.tsx
 * @owner host-squad
 * @description Renders the leaderboard screen for the host, showing ranks and
 * score changes with layout animations.
 */
import { useRef, useLayoutEffect, useMemo } from 'react'
import type { LeaderboardEntry } from '../../shared/types/index'
import '../styles/leaderboard.css'

interface LeaderBoardProps {
  leaderboard: LeaderboardEntry[]
}

type RoadmapMessage = [playerPos: number, totalQuestions: number, ...rest: (string | number)[]]

const TEST_MESSAGE: RoadmapMessage = [
  15,
  18,
  'History',
  3,
  'Biology',
  4,
  'Math',
  5,
  'Geography',
  3,
  'Physics',
  3,
]

interface RoadmapProps {
  message?: RoadmapMessage
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

  /* Roadmap */
  function Roadmap({ message = TEST_MESSAGE }: RoadmapProps) {
    const { nodes, themeStarts, playerPos, total } = useMemo(() => {
      const [playerPos, total, ...rest] = message

      const themeStarts: { index: number; theme: string }[] = []

      let i = 0
      let cursor = 1

      while (i < rest.length) {
        const theme = rest[i] as string
        const count = rest[i + 1] as number

        themeStarts.push({ index: cursor, theme })

        cursor += count
        i += 2
      }

      const nodes = Array.from({ length: total }, (_, idx) => idx + 1)

      return { nodes, themeStarts, playerPos, total }
    }, [message])

    const width = 1920
    const height = 180
    const amplitude = 35
    const midY = height / 2

    const getY = (i: number) => midY + Math.sin((i / (total - 1)) * Math.PI * 2) * amplitude

    const isThemeStart = (i: number) => themeStarts.some((t) => t.index === i)

    return (
      <div className="roadmap-container">
        <svg width="100%" viewBox={`0 0 ${width} ${height}`}>
          {nodes.map((node, idx) => {
            const padding = 40
            const usableWidth = width - padding * 2

            const x = padding + (idx / (total - 1)) * usableWidth
            const y = getY(idx)

            let className = 'questionNode'

            if (node === playerPos) className = 'playerNode'
            else if (node === total) className = 'lastNode'
            else if (node < playerPos) className = 'oldNode'

            return (
              <g key={node}>
                <circle cx={x} cy={y} r={isThemeStart(node) ? 12 : 8} className={className} />

                {isThemeStart(node) && (
                  <text x={x} y={y - 24} textAnchor="middle" className="themeLabel">
                    {themeStarts.find((t) => t.index === node)?.theme}
                  </text>
                )}

                {idx < nodes.length - 1 &&
                  (() => {
                    const nextX = ((idx + 1) / (total - 1)) * width
                    const nextY = getY(idx + 1)

                    const dots = [1 / 3, 2 / 3]

                    return dots.map((t, i) => {
                      const dx = x + (nextX - x) * t
                      const dy = y + (nextY - y) * t

                      return (
                        <circle
                          key={`${node}-dot-${i}`}
                          cx={dx}
                          cy={dy}
                          r={4}
                          className="miniDot"
                        />
                      )
                    })
                  })()}
              </g>
            )
          })}
        </svg>
      </div>
    )
  }

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
                  {entry.rankChange > 0
                    ? `▲ ${entry.rankChange}`
                    : `▼ ${Math.abs(entry.rankChange)}`}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
      <Roadmap />
    </div>
  )
}
