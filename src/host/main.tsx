/**
 * @file main.tsx
 * @owner host-squad
 * @description Host display entry point. Mounts the React app into #root and
 * wires the routes: `/` is the host display (host team), `/console` is the
 * server team's WebSocket debug console.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { App } from './App'
import { Console } from './console/Console'
import './styles/index.css'

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
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
