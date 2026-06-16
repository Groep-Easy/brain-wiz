import type { Player, ScoreMap } from '@shared/types/index'
import '../styles/leaderboard.css'

interface GameOverProps {
  players: Player[]
  finalScores: ScoreMap
  myPlayerId: string | null
}

export function GameOver({ players, finalScores, myPlayerId }: GameOverProps): React.JSX.Element {
  const nameById = new Map(players.map((p) => [p.id, p.name]))
  const standings = Object.entries(finalScores)
    .map(([playerId, score]) => ({
      playerId,
      name: nameById.get(playerId) ?? 'Player',
      score,
    }))
    .sort((a, b) => b.score - a.score)

  const myIndex = standings.findIndex((s) => s.playerId === myPlayerId)
  const myRank = myIndex >= 0 ? myIndex + 1 : null
  const myScore = myIndex >= 0 ? (standings[myIndex]?.score ?? 0) : 0

  return (
    <div className="lb-page">
      <div className="lb-hero">
        <p className="lb-hero-label">Game over — you finished</p>
        <p className="lb-hero-rank">{myRank !== null ? `#${myRank}` : '—'}</p>
        <p className="lb-hero-score">{myScore} pts</p>
      </div>
      <ul className="lb-list">
        {standings.map((s, index) => (
          <li key={s.playerId} className={`lb-row ${s.playerId === myPlayerId ? 'is-me' : ''}`}>
            <span className="lb-rank">#{index + 1}</span>
            <span className="lb-name">{s.name}</span>
            <span className="lb-score">{s.score} pts</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
