/**
 * @file main.tsx
 * @owner client-squad
 * @description Phone client entry point. Mounts the React app into #root.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles/index.css'

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root element #root not found')
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
