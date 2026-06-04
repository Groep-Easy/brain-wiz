import '../styles/LoadingComp.css'

export function LoadingComp():React.JSX.Element {
  return (
    <h2>
      Please wait...
      <br/>
      <br/>
      <div className="spinner"></div>
    </h2>
  )
}
