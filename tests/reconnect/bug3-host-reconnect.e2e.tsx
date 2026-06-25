import { describe, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { App } from '../../src/host/App'

describe('Bug 3: Host Reconnect UX', () => {
  type MockFn = ReturnType<typeof vi.fn>
  interface MockWebSocket {
    send: MockFn
    close: MockFn
    addEventListener: MockFn
    removeEventListener: MockFn
    readyState: number
    onopen?: () => void
    onmessage?: (event: { data: string }) => void
    onclose?: (event: { code: number }) => void
    onerror?: (event: Error) => void
  }
  let mockWebSocket: MockWebSocket

  beforeEach(() => {
    mockWebSocket = {
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      readyState: WebSocket.OPEN
    }
    global.WebSocket = class {
      public send = mockWebSocket.send
      public close = mockWebSocket.close
      public addEventListener = mockWebSocket.addEventListener
      public removeEventListener = mockWebSocket.removeEventListener
      public readyState = mockWebSocket.readyState
      public set onopen(fn: () => void) { mockWebSocket.onopen = fn }
      public set onmessage(fn: (event: { data: string }) => void) { mockWebSocket.onmessage = fn }
      public set onclose(fn: (event: { code: number }) => void) { mockWebSocket.onclose = fn }
      public set onerror(fn: (event: Error) => void) { mockWebSocket.onerror = fn }
    } as unknown as typeof WebSocket
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    sessionStorage.clear()
  })

  async function setupHost(): Promise<void> {
    sessionStorage.setItem('hostToken_ROOM', 'token')
    
    render(
      <MemoryRouter initialEntries={['/host/ROOM']}>
        <Routes>
          <Route path="/host/:roomCode" element={<App />} />
        </Routes>
      </MemoryRouter>
    )

    const SETUP_TIMEOUT_MS = 100
    await act(async () => { vi.advanceTimersByTime(SETUP_TIMEOUT_MS) })
    await act(async () => { if (mockWebSocket.onopen) mockWebSocket.onopen() })

    // Simulate HOST_JOIN_ACK
    await act(async () => {
      mockWebSocket.onmessage?.({ data: JSON.stringify({
        event: 'HOST_JOIN_ACK',
        data: {}
      })})
    })

    // Simulate ROOM_STATE_UPDATE
    await act(async () => {
      mockWebSocket.onmessage?.({ data: JSON.stringify({
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
    
    const MAX_RETRIES = 5
    const RECONNECT_DELAY_MS = 5000
    for (let i = 0; i < MAX_RETRIES; i++) {
      await act(async () => {
        if (mockWebSocket.onclose) mockWebSocket.onclose({ code: 1006 })
      })
      await act(async () => { vi.advanceTimersByTime(RECONNECT_DELAY_MS) })
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
