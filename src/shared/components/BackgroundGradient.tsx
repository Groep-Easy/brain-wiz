import React, { useEffect, useRef } from 'react'
import '../styles/gradients.css'

export function BackgroundGradient(): React.JSX.Element {
  const interactiveRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let curX = 0
    let curY = 0
    let tgX = 0
    let tgY = 0
    let animationFrameId: number

    const move = () => {
      curX += (tgX - curX) / 20
      curY += (tgY - curY) / 20
      if (interactiveRef.current) {
        interactiveRef.current.style.transform = `translate(${Math.round(curX)}px, ${Math.round(curY)}px)`
      }
      animationFrameId = requestAnimationFrame(move)
    }

    const handleMouseMove = (event: MouseEvent) => {
      tgX = event.clientX
      tgY = event.clientY
    }

    window.addEventListener('mousemove', handleMouseMove)
    move()

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <div className="gradient-bg-container">
      <svg xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <filter id="goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8"
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>
      <div className="gradients-container">
        <div className="g1"></div>
        <div className="g2"></div>
        <div className="g3"></div>
        <div className="g4"></div>
        <div className="g5"></div>
        <div className="interactive-glow" ref={interactiveRef}></div>
      </div>
    </div>
  )
}
