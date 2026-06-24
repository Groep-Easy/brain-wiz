import { useMemo } from 'react'
import type { LeaderboardEntry, Player } from '@brain-wiz/shared/types/index'
import { CharacterPreview } from '@brain-wiz/shared/components/CharacterPreview'
import '../styles/leaderboard.css'

interface LeaderboardProps {
  leaderboard: LeaderboardEntry[]
  myPlayerId: string | null
  players?: Player[]
}

export function Leaderboard({
  leaderboard,
  myPlayerId,
  players,
}: LeaderboardProps): React.JSX.Element {
  const me = leaderboard.find((entry) => entry.playerId === myPlayerId) ?? null

  const avatarByPlayerId = useMemo(() => {
    const map = new Map<string, Player['playerAvatar']>()
    for (const player of players ?? []) map.set(player.id, player.playerAvatar)
    return map
  }, [players])

  return (
    <div className="lb-page">
      {me ? (
        <div className="lb-hero">
          <p className="lb-hero-label">You&apos;re</p>
          <p className="lb-hero-rank">#{me.rank}</p>
          <p className="lb-hero-score">{me.score} pts</p>
          {me.rankChange !== 0 ? (
            <p className={`lb-hero-change ${me.rankChange > 0 ? 'rank-up' : 'rank-down'}`}>
              {me.rankChange > 0 ? `▲ ${me.rankChange}` : `▼ ${Math.abs(me.rankChange)}`}
            </p>
          ) : null}
        </div>
      ) : (
        <h1>Leaderboard</h1>
      )}

      <ul className="lb-list">
        {leaderboard.map((entry) => (
          <li
            key={entry.playerId}
            className={`lb-row ${entry.playerId === myPlayerId ? 'is-me' : ''}`}
          >
            <span className="lb-rank">#{entry.rank}</span>
            {(() => {
              const avatar = avatarByPlayerId.get(entry.playerId)
              return avatar ? (
                <span className="lb-avatar">
                  <CharacterPreview color={avatar.bodyColor} faceId={avatar.faceId} size={32} />
                </span>
              ) : null
            })()}
            <span className="lb-name">{entry.name}</span>
            <span className="lb-score">{entry.score} pts</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
