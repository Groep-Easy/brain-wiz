import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getBackendHttpUrl, getClientBaseUrl } from '../../shared/utils/env'
import { getBackendWsUrl } from '../../shared/utils/env'

import logo from '../assets/BrainWiz logo.png'

import '../styles/index.css'
import '../styles/welcome.css'
import '../styles/main_style.css'

const BACKEND_WS_URL = getBackendWsUrl(import.meta.env.VITE_WS_URL)
const BACKEND_HTTP_URL = getBackendHttpUrl(BACKEND_WS_URL)
const JOIN_GAME_URL = `${getClientBaseUrl()}/client`

export function WelcomeScreen(): React.JSX.Element {
  const [isCreating, setIsCreating] = useState(false)
  const navigate = useNavigate()

  const handleCreateRoom = async () => {
    setIsCreating(true)
    try {
      const res = await fetch(`${BACKEND_HTTP_URL}/rooms`, { method: 'POST' })
      if (!res.ok) {
        alert('Failed to create room on server')
        setIsCreating(false)
        return
      }
      const body = (await res.json()) as { code: string; hostToken: string }
      
      // Store host token securely in session storage to survive page reloads
      sessionStorage.setItem(`hostToken_${body.code}`, body.hostToken)
      
      // Navigate to the newly created room
      navigate(`/host/${body.code}`)
    } catch (err) {
      alert(`Error creating room: ${String(err)}`)
      setIsCreating(false)
    }
  }

  const handleJoinGame = () => {
    window.location.href = JOIN_GAME_URL
  }

  return (
    <div className="welcome-screen">
      <div className="welcome-card">
        <img src={logo} width="300" alt="Brain Wiz Logo" />
        <p className="subtitle">Interactive Quiz & Trivia Game</p>
        <div className="divider"></div>
        {isCreating ? (
          <p>Connecting to server...</p>
        ) : (
          <>
            <button className="primary-btn" onClick={handleCreateRoom}>
              Host Game
            </button>
            <div className="space"></div>
            <button className="primary-btn" onClick={handleJoinGame}>
              Join Game
            </button>
          </>
        )}
      </div>
    </div>
  )
}
