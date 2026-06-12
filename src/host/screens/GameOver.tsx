import { useEffect, useState } from 'react'
import type { Player, ScoreMap } from '../../shared/types/index'
import synthWave from '../../shared/SFX/synthwave.mp3'
import '../styles/game_over.css'

interface GameOverProps {
  players: Player[]
  finalScores: ScoreMap
  onBackToMenu: () => void
}

interface RankedPlayer {
  playerId: string
  name: string
  score: number
  rank: number
}

export function GameOver({ players, finalScores, onBackToMenu }: GameOverProps): React.JSX.Element {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Small delay so the CSS entrance animation triggers after mount
    const t = setTimeout(() => setVisible(true), 80)
    return () => clearTimeout(t)
  }, [])

  const playersMap = new Map(players.map((p) => [p.id, p.name]))

  const ranked: RankedPlayer[] = Object.entries(finalScores)
    .map(([playerId, score]) => ({
      playerId,
      name: playersMap.get(playerId) || 'Unknown',
      score,
      rank: 0,
    }))
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ ...p, rank: i + 1 }))

  const top3 = ranked.slice(0, 3)
  const rest = ranked.slice(3)

  // Podium order: 2nd (left), 1st (centre), 3rd (right)
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(
    (player): player is RankedPlayer => player !== undefined
  )

  const podiumHeights: Record<number, string> = { 1: '180px', 2: '130px', 3: '100px' }
  const podiumLabels: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

  return (
    <>
      <audio id="game-over" loop autoPlay src={synthWave} preload="auto"></audio>
      <main className={`go-page${visible ? ' go-page--visible' : ''}`}>
        {/* ── Header ── */}
        <header className="go-header">
          <h1 className="go-title">Game Over</h1>
          <p className="go-subtitle">Here's how everyone finished</p>
        </header>

        {/* ── Podium ── */}
        <section className="go-podium-wrap">
          {podiumOrder.map((player) => {
            const isFirst = player.rank === 1
            return (
              <div
                key={player.playerId}
                className={`go-podium-slot go-podium-slot--${player.rank}`}
              >
                {/* name + medal above the block */}
                <div className="go-podium-name-wrap">
                  <span className="go-podium-medal">{podiumLabels[player.rank]}</span>
                  <span className="go-podium-name">{player.name}</span>
                  <span className="go-podium-score">{player.score.toLocaleString()} pts</span>
                </div>

                {/* the actual podium block */}
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

        {/* ── Rest of players ── */}
        {rest.length > 0 && (
          <section className="go-rest-wrap">
            <ul className="go-rest-list">
              {rest.map((player) => (
                <li key={player.playerId} className="go-rest-row">
                  <span className="go-rest-rank">#{player.rank}</span>
                  <span className="go-rest-name">{player.name}</span>
                  <span className="go-rest-score">{player.score.toLocaleString()} pts</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Back to menu ── */}
        <button className="go-back-btn go-back-btn--client" onClick={onBackToMenu}>
          Back to Main Menu
        </button>
      </main>
    </>
  )
}
