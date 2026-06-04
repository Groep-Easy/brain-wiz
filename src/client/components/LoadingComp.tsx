import '../styles/LoadingComp.css'

export function LoadingComp(): React.JSX.Element {
  return (
    <div className="lobby-screen">
      <div className="lobby-illustration">🎮</div>

      <h2 className="lobby-title">Waiting for host</h2>

      <p className="lobby-text">
        Game will start soon
        <span className="dots">
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </p>
    </div>
  )
}
