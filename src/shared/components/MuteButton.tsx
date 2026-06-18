import { useEffect, useState } from 'react'
import {
  isMuted,
  getVolume,
  toggleMuted,
  setVolume,
  onMuteChange,
  onVolumeChange,
  watchMedia,
} from '@brain-wiz/shared/SFX/mute'
import '../styles/mute_button.css'

export function MuteButton({ isInline = false }: { isInline?: boolean } = {}): React.JSX.Element {
  const [muted, setMuted] = useState<boolean>(isMuted)
  const [volume, setVolumeValue] = useState<number>(getVolume)

  useEffect(() => {
    const stopWatching = watchMedia()
    const unsubscribeMute = onMuteChange(setMuted)
    const unsubscribeVolume = onVolumeChange(setVolumeValue)
    return () => {
      stopWatching()
      unsubscribeMute()
      unsubscribeVolume()
    }
  }, [])

  const sliderValue = muted ? 0 : volume

  const speaker = (
    <button
      type="button"
      className={`mute-btn icon-btn ${!isInline ? 'mute-btn-fixed' : ''} ${muted ? 'is-muted' : 'active'}`}
      onClick={() => toggleMuted()}
      title={muted ? 'Unmute sound' : 'Mute sound'}
      aria-label={muted ? 'Unmute sound' : 'Mute sound'}
      aria-pressed={muted}
    >
      <svg viewBox="0 0 24 24" width="26" height="26" className="speaker-icon">
        <path className="speaker-cone" d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor" />
        <path
          className="wave wave-inner"
          d="M15.54 8.46a5 5 0 0 1 0 7.07"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          className="wave wave-outer"
          d="M19.07 4.93a10 10 0 0 1 0 14.14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          className="strike"
          x1="2"
          y1="2"
          x2="22"
          y2="22"
          stroke="var(--red, #ba162d)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </button>
  )

  if (!isInline) return speaker

  return (
    <div className="volume-control">
      {speaker}
      <input
        type="range"
        className="volume-slider"
        min={0}
        max={1}
        step={0.01}
        value={sliderValue}
        onChange={(e) => setVolume(Number(e.target.value))}
        title="Volume"
        aria-label="Volume"
        style={{ ['--volume-pct']: `${sliderValue * 100}%` } as React.CSSProperties}
      />
    </div>
  )
}
