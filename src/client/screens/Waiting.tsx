interface WaitingProps {
  playerName: string
  roomCode: string
  onLeave: () => void
}

export function Waiting({ playerName, roomCode, onLeave }: WaitingProps): React.JSX.Element {
  return (
    <>
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
        <div className="divider" />
        <button className="leave-btn" onClick={onLeave} type="button">
          Leave room
        </button>
      </div>
    </>
  )
}
