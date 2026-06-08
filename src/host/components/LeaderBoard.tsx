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

const TEST_MESSAGE: RoadmapMessage = [1, 5, 'General', 5]

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

  function Roadmap({ message = TEST_MESSAGE }: RoadmapProps) {
    const { playerPos, total, themeStarts, themeMap, timeline } = useMemo(() => {
      const [playerPos, total, ...rest] = message

      const themeStarts: { index: number; theme: string }[] = []
      const themeMap = new Map<number, string>()

      let i = 0
      let cursor = 1

      while (i < rest.length) {
        const theme = rest[i] as string
        const count = rest[i + 1] as number

        themeStarts.push({
          index: cursor,
          theme,
        })

        themeMap.set(cursor, theme)

        cursor += count
        i += 2
      }

      type TimelineItem =
        | {
            type: 'node'
            questionNumber: number
          }
        | {
            type: 'dot'
          }

      const timeline: TimelineItem[] = []

      for (let q = 1; q <= total; q++) {
        timeline.push({
          type: 'node',
          questionNumber: q,
        })

        if (q < total) {
          timeline.push({ type: 'dot' })
          timeline.push({ type: 'dot' })
        }
      }

      return {
        playerPos,
        total,
        themeStarts,
        themeMap,
        timeline,
      }
    }, [message])

    const themeStartSet = useMemo(() => new Set(themeStarts.map((t) => t.index)), [themeStarts])

    const STEP = 70
    const PADDING = 100

    const WIDTH = Math.max(1920, PADDING * 2 + (timeline.length - 1) * STEP)

    const HEIGHT = 180
    const AMPLITUDE = 35
    const MID_Y = HEIGHT / 2

    const WAVELENGTH = 630

    const getY = (x: number) => MID_Y + AMPLITUDE * Math.sin((x / WAVELENGTH) * Math.PI * 2)

    const getNodeClass = (questionNumber: number) => {
      if (questionNumber < playerPos) {
        return 'oldNode'
      }

      if (questionNumber === playerPos) {
        return 'playerNode'
      }

      if (questionNumber === total) {
        return 'lastNode'
      }
      return 'questionNode'
    }

    const containerRef = useRef<HTMLDivElement>(null)

    useLayoutEffect(() => {
      const container = containerRef.current

      if (!container) return

      const viewportWidth = container.clientWidth

      const playerTimelineIndex = (playerPos - 1) * 3
      const playerX = PADDING + playerTimelineIndex * STEP

      const targetScrollLeft = playerX - viewportWidth / 3

      const maxScrollLeft = container.scrollWidth - viewportWidth

      container.scrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScrollLeft))
    }, [playerPos])

    return (
      <div
        style={{
          overflowX: 'auto',
          width: '100%',
        }}
        ref={containerRef}
      >
        <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
          {timeline.map((item, index) => {
            const x = PADDING + index * STEP
            const y = getY(x)

            if (item.type === 'dot') {
              return <circle key={`dot-${index}`} cx={x} cy={y} r={4} className="miniDot" />
            }

            const isThemeNode = themeStartSet.has(item.questionNumber)

            return (
              <g key={item.questionNumber}>
                <circle
                  cx={x}
                  cy={y}
                  r={isThemeNode ? 12 : 8}
                  className={getNodeClass(item.questionNumber)}
                />

                {isThemeNode && (
                  <text x={x} y={y - 24} textAnchor="middle" className="themeLabel">
                    {themeMap.get(item.questionNumber)}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>
    )
  }

  return (
    <>
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
      </div>
      <div className="roadmap-container">
        <Roadmap />
      </div>
    </>
  )
}
