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
      className={`mute-btn icon-btn ${muted ? 'is-muted' : ''}`}
      onClick={() => toggleMuted()}
      title={muted ? 'Unmute sound' : 'Mute sound'}
      aria-label={muted ? 'Unmute sound' : 'Mute sound'}
      aria-pressed={muted}
    >
      <svg viewBox="0 0 24 24" width="26" height="26" className="speaker-icon">
        <path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor" />
        <path className="wave wave-inner" d="M15.54 8.46a5 5 0 0 1 0 7.07" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path className="wave wave-outer" d="M19.07 4.93a10 10 0 0 1 0 14.14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <line className="strike" x1="2" y1="2" x2="22" y2="22" stroke="var(--red, #ba162d)" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </button>
  )
}
