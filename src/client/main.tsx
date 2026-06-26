/**
 * @file main.tsx
 * @owner client-squad
 * @description Phone client entry point. Mounts the React app into #root and
 * wires the routes: `/` is the phone client (client team) and `/game` is the
 * sliding-puzzle minigame.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { App } from './App'
import { Game } from './screens/Game'
import { GlassFilter } from '@brain-wiz/shared/components/GlassFilter'
import { BackgroundGradient } from '@brain-wiz/shared/components/BackgroundGradient'
import { MuteButton } from '@brain-wiz/shared/components/MuteButton'
import { ErrorBoundary } from '@brain-wiz/shared/components/ErrorBoundary'
import '@brain-wiz/shared/styles/gradients.css'
import '@brain-wiz/shared/styles/global.css'
import './styles/cards.css'
import { LoadingComp } from './components/LoadingComp'

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root element #root not found')
}

createRoot(container).render(
  <StrictMode>
    <BackgroundGradient />
    <GlassFilter />
    <MuteButton />
    {/* basename must match the Vite base / Express mount so React Router
        resolves paths correctly: /client/game matches route path="/game" */}
    <BrowserRouter basename="/client">
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/game" element={<Game />} />
          <Route path="/loadingComp" element={<LoadingComp />}></Route>
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>
)
