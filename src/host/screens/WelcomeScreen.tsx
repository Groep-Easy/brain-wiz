import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getBackendHttpUrl, getClientBaseUrl } from '@brain-wiz/shared/utils/env'
import { getBackendWsUrl } from '@brain-wiz/shared/utils/env'
import { WizardLogo } from '@brain-wiz/shared/components/WizardLogo'

import '../styles/welcome.css'

const BACKEND_WS_URL = getBackendWsUrl(import.meta.env.VITE_WS_URL)
const BACKEND_HTTP_URL = getBackendHttpUrl(BACKEND_WS_URL)
const JOIN_GAME_URL = `${getClientBaseUrl()}/client`

export function WelcomeScreen(): React.JSX.Element {
  const [isCreating, setIsCreating] = useState(false)
  const navigate = useNavigate()
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

  const handleCreateRoom = async () => {
    setIsCreating(true)
    try {
      const res = await fetch(`${BACKEND_HTTP_URL}/rooms`, { method: 'POST' })
      if (!res.ok) {
        // eslint-disable-next-line no-alert -- intentional native error dialog
        alert('Failed to create room on server')
        setIsCreating(false)
        return
      }
      const body = (await res.json()) as { code: string; hostToken: string }

      // Store host token securely in session storage to survive page reloads
      sessionStorage.setItem(`hostToken_${body.code}`, body.hostToken)

      // Navigate to the newly created room
      void navigate(`/host/${body.code}`)
    } catch (err) {
      // eslint-disable-next-line no-alert -- intentional native error dialog
      alert(`Error creating room: ${String(err)}`)
      setIsCreating(false)
    }
  }

  const handleJoinGame = () => {
    window.location.href = JOIN_GAME_URL
  }

  return (
    <div className="welcome-screen">
      <div className="gradient-bg-container">
        <svg xmlns="http://www.w3.org/2000/svg">
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

      <div className="floating-shapes">
        <svg className="floating-shape shape-1" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
        </svg>
        <svg className="floating-shape shape-2" viewBox="0 0 24 24">
          <rect x="4" y="4" width="16" height="16" rx="4" />
        </svg>
        <svg className="floating-shape shape-3" viewBox="0 0 24 24">
          <polygon points="12,2 22,20 2,20" />
        </svg>
      </div>

      <div className="hero-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <WizardLogo size={80} className="hero-logo-svg" />
        <h1 className="text-logo" style={{ fontSize: '6rem', margin: '16px 0', color: 'white' }}>BrainWiz</h1>
        {isCreating ? (
          <p style={{ color: '#ccc' }}>Connecting to server...</p>
        ) : (
          <div className="hero-actions">
            <button className="primary-btn" onClick={handleCreateRoom}>
              Start Hosting Game
            </button>
            <button className="primary-btn" onClick={handleJoinGame}>
              Join Existing Game
            </button>
          </div>
        )}
      </div>

      <div className="hero-footer">
        <p>2026 BrainWiz™. All rights reserved.</p>
      </div>
    </div>
  )
}
