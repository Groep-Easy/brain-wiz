import { useEffect, useState } from 'react'
import './CountdownCircle.css'

interface CountdownCircleProps {
  seconds: number
  message: string
  onComplete: () => void
}

export function CountdownCircle({
  seconds,
  message,
  onComplete,
}: CountdownCircleProps): React.JSX.Element {
  const [timeLeft, setTimeLeft] = useState(seconds)

  useEffect(() => {
    if (timeLeft <= 0) {
      onComplete()
      return
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [timeLeft, onComplete])

  const circumference = 283
  const progress = timeLeft / seconds
  const strokeDashoffset = circumference - progress * circumference

  return (
    <div className="countdown-container">
      <div className="countdown-circle">
        <svg viewBox="0 0 100 100">
          <circle className="countdown-circle-bg" cx="50" cy="50" r="45" />
          <circle
            className="countdown-circle-progress"
            cx="50"
            cy="50"
            r="45"
            style={{ strokeDashoffset }}
          />
        </svg>
        <div className="countdown-number">{timeLeft}</div>
      </div>
      <p className="countdown-message">{message}</p>
    </div>
  )
}
