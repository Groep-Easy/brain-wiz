import { useEffect, useState } from 'react'
import { isMuted, toggleMuted, onMuteChange, watchMedia } from '../../shared/SFX/mute'
import '../styles/mute_button.css'

/**
 * Fixed button in the top-right corner of the host display that mutes/unmutes
 * all game sound (background music + SFX). Mounted once at the host route so it
 * floats above whatever screen/phase is currently showing.
 */
export function MuteButton(): React.JSX.Element {
  const [muted, setMuted] = useState<boolean>(isMuted)

  useEffect(() => {
    // Keep newly-mounted <audio> elements (per-screen music) in sync, and
    // mirror state changes coming from anywhere else.
    const stopWatching = watchMedia()
    const unsubscribe = onMuteChange(setMuted)
    return () => {
      stopWatching()
      unsubscribe()
    }
  }, [])

  return (
    <button
      type="button"
      className="mute-btn circle-btn"
      onClick={() => toggleMuted()}
      title={muted ? 'Unmute sound' : 'Mute sound'}
      aria-label={muted ? 'Unmute sound' : 'Mute sound'}
      aria-pressed={muted}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  )
}
