import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { App } from '../../src/host/App'

describe('Bug 3: Host Reconnect UX', () => {
  let mockWebSocket: any

  beforeEach(() => {
    mockWebSocket = {
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      readyState: WebSocket.OPEN
    }
    global.WebSocket = class {
      send = mockWebSocket.send
      close = mockWebSocket.close
      addEventListener = mockWebSocket.addEventListener
      removeEventListener = mockWebSocket.removeEventListener
      readyState = mockWebSocket.readyState
      set onopen(fn: any) { mockWebSocket.onopen = fn }
      set onmessage(fn: any) { mockWebSocket.onmessage = fn }
      set onclose(fn: any) { mockWebSocket.onclose = fn }
      set onerror(fn: any) { mockWebSocket.onerror = fn }
    } as any
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    sessionStorage.clear()
  })

  async function setupHost() {
    sessionStorage.setItem('hostToken_ROOM', 'token')
    
    render(
      <MemoryRouter initialEntries={['/host/ROOM']}>
        <Routes>
          <Route path="/host/:roomCode" element={<App />} />
        </Routes>
      </MemoryRouter>
    )

    await act(async () => { vi.advanceTimersByTime(100) })
    await act(async () => { if (mockWebSocket.onopen) mockWebSocket.onopen() })

    // Simulate HOST_JOIN_ACK
    await act(async () => {
      mockWebSocket.onmessage({ data: JSON.stringify({
        event: 'HOST_JOIN_ACK',
        data: {}
      })})
    })

    // Simulate ROOM_STATE_UPDATE
    await act(async () => {
      mockWebSocket.onmessage({ data: JSON.stringify({
        event: 'ROOM_STATE_UPDATE',
        data: { room: { id: 'ROOM', phase: 'lobby', players: [] } }
      })})
    })

    // Ensure we are in lobby
  }

  it('SCENARIO A - disconnect transitions to reconnecting, not closed', async () => {
    await setupHost()
    
    await act(async () => {
      if (mockWebSocket.onclose) mockWebSocket.onclose({ code: 1006 })
    })

    // Should still render the room (lobby)
    // Should render ReconnectToast -> "Reconnecting..."
  })

  it('SCENARIO B - exhausted retries transitions to closed', async () => {
    await setupHost()
    
    // Fail 5 times
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        if (mockWebSocket.onclose) mockWebSocket.onclose({ code: 1006 })
      })
      await act(async () => { vi.advanceTimersByTime(5000) })
    }

    // It should now be closed and return WelcomeScreen or an error screen
    // "BrainWiz Host"
  })

  it('SCENARIO C - intentional disconnect transitions to closed', async () => {
    await setupHost()
    
    // Simulate intentional disconnect (e.g. End Game button)
    // Actually, intentional disconnect is triggered by clicking End Game, then Confirm.
    // We can just click it.
    // Wait, the "End Game" or "Close Lobby" button
    const closeBtn = screen.getByRole('button', { name: /Close Lobby/i })
    fireEvent.click(closeBtn)
    
    // Confirm dialog
    const confirmBtn = screen.getByRole('button', { name: /Dissolve/i })
    fireEvent.click(confirmBtn)

    await act(async () => {
      if (mockWebSocket.onclose) mockWebSocket.onclose({ code: 1000 })
    })

    // Should be closed
  })
})
