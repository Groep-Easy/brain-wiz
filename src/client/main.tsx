/**
 * @file main.tsx
 * @owner client-squad
 * @description Phone client entry point. Mounts the React app into #root and
 * wires the routes: `/` is the phone client (client team), `/console` is the
 * server team's WebSocket debug console.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { App } from './App'
import { Console } from './console/Console'
import './styles/index.css'
import { LoadingComp } from './components/LoadingComp'

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root element #root not found')
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/console" element={<Console />} />
        <Route path="/loadingComp" element={<LoadingComp />}></Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
