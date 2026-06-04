import type { Player, ScoreMap } from '../../shared/types/index'

interface GameOverProps {
  players: Player[]
  finalScores: ScoreMap
  onBackToMenu: () => void
}

export function GameOver({ players, finalScores, onBackToMenu }: GameOverProps): React.JSX.Element {
  const playersMap = new Map(players.map((p) => [p.id, p.name]))
  const sortedScores = Object.entries(finalScores)
    .map(([playerId, score]) => ({
      playerId,
      name: playersMap.get(playerId) || 'Unknown Player',
      score,
    }))
    .sort((a, b) => b.score - a.score)

  return (
    <main className="app">
      <div className="game-over-screen">
        <div className="game-over-card">
          <h1>Game Over</h1>
          <p className="subtitle">Final Standings</p>
          <div className="divider"></div>
          <ul className="final-scores-list">
            {sortedScores.map((score, index) => (
              <li
                key={score.playerId}
                className={`final-score-item ${index === 0 ? 'winner' : ''}`}
              >
                <span>
                  #{index + 1} {score.name}
                </span>
                <span>{score.score} pts</span>
              </li>
            ))}
          </ul>
          <button className="primary-btn" onClick={onBackToMenu}>
            Back to Main Menu
          </button>
        </div>
      </div>
    </main>
  )
}
