import '../styles/leaderboard.css'
import { useEffect, useState } from 'react'
import type { Player, ScoreMap } from '@shared/types/index'
import '../styles/game_over.css'

interface GameOverProps {
  players: Player[]
  finalScores: ScoreMap
  myPlayerId: string | null
  onBackToMenu: () => void
}

interface RankedPlayer {
  playerId: string
  name: string
  score: number
  rank: number
}

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

export function GameOver({ players, finalScores, myPlayerId, onBackToMenu }: GameOverProps): React.JSX.Element {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60)
    return () => clearTimeout(t)
  }, [])

  const nameById = new Map(players.map((p) => [p.id, p.name]))

  const ranked: RankedPlayer[] = Object.entries(finalScores)
    .map(([playerId, score]) => ({
      playerId,
      name: nameById.get(playerId) ?? 'Player',
      score,
      rank: 0,
    }))
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ ...p, rank: i + 1 }))

  const me = ranked.find((p) => p.playerId === myPlayerId) ?? null
  const top3 = ranked.slice(0, 3)

  const isInTop3 = me !== null && me.rank <= 3

  const podiumOrder = [top3[1], top3[0], top3[2]].filter(
    (player): player is RankedPlayer => player !== undefined
  )

  // These inline heights dictate the visual differences along with our CSS!
  const podiumHeights: Record<number, string> = { 1: '140px', 2: '100px', 3: '70px' }

  const heroLabel = (): string => {
    if (me === null) return 'Game over'
    if (me.rank === 1) return '🏆 You won!'
    if (me.rank === 2) return 'So close — 2nd place!'
    if (me.rank === 3) return 'Nice — top 3!'
    return 'Game over'
  }

  return (
    // Note the added go-page--client modifier
    <div className={`go-page go-page--client${visible ? ' go-page--visible' : ''}`}>

      {/* ── Personal hero card ── */}
      <div className={`go-hero${isInTop3 ? ' go-hero--top3' : ''}`}>
        <p className="go-hero-label">{heroLabel()}</p>
        <p className="go-hero-rank">
          {me !== null ? `#${me.rank}` : '—'}
        </p>
        <p className="go-hero-score">
          {me !== null ? `${me.score.toLocaleString()} pts` : ''}
        </p>
      </div>

      {/* ── Top 3 Podium ── */}
      <section className="go-podium-wrap">
        {podiumOrder.map((player) => {
          const isFirst = player.rank === 1
          const isMe = player.playerId === myPlayerId

          return (
            <div
              key={player.playerId}
              className={`go-podium-slot go-podium-slot--${player.rank}${isMe ? ' is-me' : ''}`}
            >
              <div className="go-podium-name-wrap">
                <span className="go-podium-medal">{MEDALS[player.rank]}</span>
                <span className="go-podium-name">{player.name}</span>
                <span className="go-podium-score">{player.score.toLocaleString()} pts</span>
              </div>

              <div
                className={`go-podium-block${isFirst ? ' go-podium-block--first' : ''}`}
                style={{ height: podiumHeights[player.rank] }}
              >
                <span className="go-podium-rank">#{player.rank}</span>
              </div>
            </div>
          )
        })}
      </section>

      {/* ── Back to Menu Button ── */}
      <button className="go-back-btn go-back-btn--client" onClick={onBackToMenu}>
        Back to Main Menu
      </button>

    </div>
  )
}
