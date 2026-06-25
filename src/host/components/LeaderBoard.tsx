/**
 * @file LeaderBoard.tsx
 * @owner host-squad
 * @description Renders the leaderboard screen for the host, showing ranks and
 * score changes with layout animations.
 */
import { useRef, useLayoutEffect, useMemo } from 'react'
import type { LeaderboardEntry, Player } from '@brain-wiz/shared/types/index'
import type { RoadmapUpdate } from '@brain-wiz/shared/types/index'
import { CharacterPreview } from '@brain-wiz/shared/components/CharacterPreview'
import { PALETTE } from '../flow/palette'
import '../styles/leaderboard.css'

import leaderboardMusic from '@brain-wiz/shared/SFX/leaderboard.mp3'

interface LeaderBoardProps {
  leaderboard: LeaderboardEntry[]
  roadmap?: RoadmapUpdate | null
  players?: Player[]
}

interface RoadmapProps {
  roadmap?: RoadmapUpdate | undefined
}

type TimelineItem =
  | {
      type: 'node'
      questionNumber: number
    }
  | {
      type: 'dot'
    }

const paletteLookup = new Map(PALETTE.map((item) => [normalizeId(item.id), item]))

function normalizeId(id: string) {
  return id.replace(/^(theme-|mini-)/, '')
}

function Roadmap({ roadmap }: RoadmapProps) {
  const { playerPos, total, themeStarts, themeMap, timeline } = useMemo(() => {
    const themeStarts: { index: number; theme: string }[] = []
    const themeMap = new Map<number, string>()

    if (!roadmap) {
      return { playerPos: 0, total: 0, themeStarts, themeMap, timeline: [] as TimelineItem[] }
    }

    const { playerPos, totalQuestions, themes } = roadmap

    let cursor = 1

    for (const themeEntry of themes) {
      themeStarts.push({
        index: cursor,
        theme: themeEntry.theme,
      })

      themeMap.set(cursor, themeEntry.theme)

      cursor += themeEntry.questionsInTheme
    }

    const timeline: TimelineItem[] = []

    for (let q = 1; q <= totalQuestions; q++) {
      timeline.push({
        type: 'node',
        questionNumber: q,
      })

      if (q < totalQuestions) {
        timeline.push({ type: 'dot' })
        timeline.push({ type: 'dot' })
      }
    }

    return {
      playerPos,
      total: totalQuestions,
      themeStarts,
      themeMap,
      timeline,
    }
  }, [roadmap])

  const themeStartSet = useMemo(() => new Set(themeStarts.map((t) => t.index)), [themeStarts])

  const STEP = 70
  const PADDING = 100

  const WIDTH = PADDING * 2 + (timeline.length - 1) * STEP

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
    const scrollable = WIDTH > viewportWidth

    if (scrollable) {
      const playerTimelineIndex = (playerPos - 1) * 3
      const playerX = PADDING + playerTimelineIndex * STEP

      container.scrollLeft = Math.max(0, playerX - viewportWidth / 3)
    } else {
      container.scrollLeft = 0
    }
  }, [WIDTH, playerPos])

  // Guard placed AFTER all hooks so they run unconditionally on every render (rules-of-hooks).
  if (!roadmap) {
    return null
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        overflowX: 'auto',
        overflowY: 'hidden',
      }}
    >
      <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        {timeline.map((item, index) => {
          const x = PADDING + index * STEP
          const y = getY(x)

          if (item.type === 'dot') {
            return <circle key={`dot-${index}`} cx={x} cy={y} r={4} className="miniDot" />
          }

          const rawTheme = themeMap.get(item.questionNumber)
          const paletteItem = rawTheme ? paletteLookup.get(rawTheme) : undefined

          const isThemeNode = themeStartSet.has(item.questionNumber)

          return (
            <g key={item.questionNumber}>
              <circle
                cx={x}
                cy={y}
                r={isThemeNode ? 18 : 12}
                className={getNodeClass(item.questionNumber)}
              />

              {isThemeNode && (
                <g>
                  <text x={x} y={y + 5} textAnchor="middle" fontSize={18}>
                    {paletteItem?.icon}
                  </text>

                  <text x={x} y={y - 24} textAnchor="middle" className="themeLabel">
                    {paletteItem?.label ?? rawTheme}
                  </text>
                </g>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export function LeaderBoard({
  leaderboard,
  roadmap,
  players,
}: LeaderBoardProps): React.JSX.Element {
  const itemRefs = useRef<Map<string, HTMLLIElement>>(new Map())
  const previousPositions = useRef<Map<string, number>>(new Map())

  const avatarByPlayerId = useMemo(() => {
    const map = new Map<string, Player['playerAvatar']>()
    for (const player of players ?? []) map.set(player.id, player.playerAvatar)
    return map
  }, [players])

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
    <>
      <audio id="leaderboard-music" autoPlay src={leaderboardMusic} preload="auto"></audio>
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
                {(() => {
                  const avatar = avatarByPlayerId.get(entry.playerId)
                  return avatar ? (
                    <span className="player-avatar">
                      <CharacterPreview color={avatar.bodyColor} faceId={avatar.faceId} size={44} />
                    </span>
                  ) : null
                })()}
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
        <Roadmap roadmap={roadmap ?? undefined} />
      </div>
    </>
  )
}
