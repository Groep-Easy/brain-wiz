/**
 * @file main.tsx
 * @owner host-squad
 * @description Host display entry point. Mounts the React app into #root and
 * wires the routes: `/` is the host display (host team), `/console` is the
 * server team's WebSocket debug console.
 *
 * NOTE: The leaderboard screen is driven by live game state from inside App —
 * it is NOT a standalone route because LeaderBoard requires a `leaderboard`
 * prop that only the game state machine can supply.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { App } from './App'
import { Console } from './console/Console'
import { ScaleMechanicsMock } from '../minigames/balance-scale/mock/ScaleMechanicsMock'
import { SlidingPuzzleMock } from '../minigames/sliding-puzzle/mock/SlidingPuzzleMock'
import './styles/index.css'

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root element #root not found')
}

createRoot(container).render(
  <StrictMode>
    {/* basename must match the Vite base / Express mount so React Router
        resolves paths correctly: /host/console matches route path="/console" */}
    <BrowserRouter basename="/host">
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/console" element={<Console />} />
        <Route path="/balance-scale-mock" element={<ScaleMechanicsMock />} />
        <Route path="/sliding-puzzle-mock" element={<SlidingPuzzleMock />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
