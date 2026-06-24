import { useEffect, useRef, useState, type JSX } from 'react'

interface BonkAirScorecardProps {
  /** Final points awarded this round; the display animates up to this value. */
  points: number
}

const COUNT_UP_MS = 900

/**
 * End-of-round Bonk Air score card: just the points, rapidly counting up from
 * zero for a satisfying reveal. No icon or message — only the number.
 */
export function BonkAirScorecard({ points }: BonkAirScorecardProps): JSX.Element {
  const [display, setDisplay] = useState(0)
  const rafRef = useRef(0)

  useEffect(() => {
    const target = Math.max(0, Math.round(points))
    if (target === 0) {
      setDisplay(0)
      return undefined
    }
    let start: number | null = null
    const tick = (now: number): void => {
      if (start === null) start = now
      const t = Math.min(1, (now - start) / COUNT_UP_MS)
      // easeOutCubic — fast at the start, snappy settle at the end.
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(target * eased))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [points])

  return (
    <div className="bonk-air-scorecard">
      <div className="bonk-air-scorecard__points">+{display}</div>
    </div>
  )
}
