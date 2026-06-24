import { useEffect, useState } from 'react'
import '../styles/reconnect-toast.css'

const RECONNECT_TOAST_MS = 5000

export function ReconnectToast({ visible }: { visible: boolean }): React.JSX.Element | null {
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (!visible) {
      setActive(false)
      return
    }
    setActive(true)
    const timer = setTimeout(() => setActive(false), RECONNECT_TOAST_MS)
    return () => clearTimeout(timer)
  }, [visible])

  if (!active) return null

  return (
    <div className="reconnect-toast" role="status" aria-live="polite">
      <span className="reconnect-toast-text">Trying to reconnect…</span>
      <div className="reconnect-toast-progress">
        <div className="reconnect-toast-progress-bar" />
      </div>
    </div>
  )
}
