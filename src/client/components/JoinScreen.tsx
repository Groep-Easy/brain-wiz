export function JoinScreen({ onJoin }: { onJoin: () => void }) {
  return (
    <div className="screen">
      <h2>Join game</h2>
      <label>Set name: </label>
      <input type="text" id="name"></input><br></br>
      <label>Room code: </label>
      <input type="text" id="room"></input><br></br>
      <button onClick={onJoin}>Join room</button>
    </div>
  )
}
