/**
 * @file main.tsx
 * @owner host-squad
 * @description Host display entry point. Mounts the React app into #root and
 * wires the routes: `/` is the host display (host team).
 *
 * NOTE: The leaderboard screen is driven by live game state from inside App —
 * it is NOT a standalone route because LeaderBoard requires a `leaderboard`
 * prop that only the game state machine can supply.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom'
import { App } from './App'
import { WelcomeScreen } from './screens/WelcomeScreen'
import { LeaderBoard } from './components/LeaderBoard'
import { ScaleMechanicsMock } from '@brain-wiz/minigames/balance-scale/mock/ScaleMechanicsMock'
import { SlidingPuzzleMock } from '@brain-wiz/minigames/sliding-puzzle/mock/SlidingPuzzleMock'
import { BonkAirMock } from '@brain-wiz/minigames/bonk-air/mock/BonkAirMock'
import { GlassFilter } from '@brain-wiz/shared/components/GlassFilter'
import { BackgroundGradient } from '@brain-wiz/shared/components/BackgroundGradient'
import { ErrorBoundary } from '@brain-wiz/shared/components/ErrorBoundary'
import '@brain-wiz/shared/styles/global.css'

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root element #root not found')
}

const mockLeaderboard = [
  {
    playerId: 'p1',
    name: 'Alice',
    score: 1500,
    rank: 1,
    previousRank: 2,
    rankChange: 1,
    connected: true,
  },
  {
    playerId: 'p2',
    name: 'Bob',
    score: 1200,
    rank: 2,
    previousRank: 1,
    rankChange: -1,
    connected: true,
  },
  {
    playerId: 'p3',
    name: 'Charlie',
    score: 900,
    rank: 3,
    previousRank: null,
    rankChange: 0,
    connected: false,
  },
]

createRoot(container).render(
  <StrictMode>
    <BackgroundGradient />
    <GlassFilter />
    {/* The host app is now served from the root, so no basename is needed */}
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<WelcomeScreen />} />
          <Route path="/welcome" element={<Navigate to="/" replace />} />
          <Route
            path="/host/:roomCode"
            element={
              <App />
            }
          />
          <Route
            path="/screens/leaderboard"
            element={<LeaderBoard leaderboard={mockLeaderboard} />}
          />
          <Route path="/balance-scale-mock" element={<ScaleMechanicsMock />} />
          <Route path="/sliding-puzzle-mock" element={<SlidingPuzzleMock />} />
          <Route path="/bonk-air-mock" element={<BonkAirMock />} />
          {/* Fallback for /host or any unrecognized path */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>
)
