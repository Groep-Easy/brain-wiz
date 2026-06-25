import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { getBackendHttpUrl, getBackendWsUrl, getClientBaseUrl } from '@brain-wiz/shared/utils/env'
import { WizardLogo } from '@brain-wiz/shared/components/WizardLogo'

import { BackgroundGradient } from '@brain-wiz/shared/components/BackgroundGradient'
import '../styles/welcome.css'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Vite env variable
const BACKEND_WS_URL = getBackendWsUrl(import.meta.env.VITE_WS_URL)
const BACKEND_HTTP_URL = getBackendHttpUrl(BACKEND_WS_URL)
const JOIN_GAME_URL = `${getClientBaseUrl()}/client`

export function WelcomeScreen(): React.JSX.Element {
  const [isCreating, setIsCreating] = useState(false)
  const navigate = useNavigate()
  const handleCreateRoom = async () => {
    if (isCreating) return

    setIsCreating(true)

    try {
      const res = await fetch(`${BACKEND_HTTP_URL}/rooms`, {
        method: 'POST',
      })

      if (!res.ok) {
        console.error('Failed to create room on server')
        setIsCreating(false)
        return
      }

      const body = (await res.json()) as { code: string; hostToken: string }

      sessionStorage.setItem(`hostToken_${body.code}`, body.hostToken)

      void navigate(`/host/${body.code}`)
    } catch (err) {
      console.error(`Error creating room: ${String(err)}`)
      setIsCreating(false)
    }
  }

  const handleJoinGame = () => {
    window.location.href = JOIN_GAME_URL
  }

  return (
    <div className="welcome-screen">
      <BackgroundGradient />

      <div
        className="hero-content"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
      >
        <WizardLogo size={80} className="hero-logo-svg" />

        <h1 className="text-logo" style={{ fontSize: '5rem', margin: '16px 0', color: 'white' }}>
          BrainWiz
        </h1>

        <div className="hero-actions">
          <button className="hero-btn hero-btn--primary" onClick={handleCreateRoom}>
            Start Hosting Game
          </button>

          <button className="hero-btn hero-btn--secondary" onClick={handleJoinGame}>
            Join Existing Game
          </button>
        </div>
      </div>

      <div className="hero-footer">
        <p>2026 BrainWiz™. All rights reserved.</p>
      </div>
    </div>
  )
}
