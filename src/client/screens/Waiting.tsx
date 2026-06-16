interface WaitingProps {
  playerName: string
  roomCode: string
}

export function Waiting({ playerName, roomCode }: WaitingProps): React.JSX.Element {
  return (
    <div className="game-card client-card">
      <h1>You&apos;re in! 🎉</h1>
      <p className="subtitle">
        {playerName ? `Hang tight, ${playerName} — ` : 'Hang tight — '}
        waiting for the host to start.
      </p>
      <div className="divider" />
      <p>
        Room <span className="code-pill">{roomCode || '----'}</span>
      </p>
    </div>
  )
}
