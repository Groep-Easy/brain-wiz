export function JoinScreen({ onJoin }: { onJoin: () => void }) {
  return (
    <div className="screen">
      <h2>Join game</h2>

      <div className="join-form">
        <label htmlFor="name">Set name</label>
        <input type="text" id="name" />

        <label htmlFor="room">Room code</label>
        <input type="text" id="room" />

        <button onClick={onJoin}>Join room</button>
      </div>
    </div>
  )
}
