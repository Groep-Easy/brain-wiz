import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { App } from '../../src/client/App'
import { ROUND_CONTENT_SHOW, ROOM_STATE_UPDATE } from '@brain-wiz/shared/constants/socket-events.constants'

describe('Bug 2: Already-Answered', () => {
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
  })

  async function setupGame(): Promise<void> {
    sessionStorage.setItem('creds_ABC', JSON.stringify({ playerId: 'p1', reconnectToken: 'tk', playerName: 'Alice', roomCode: 'ABC' }))
    
    render(
      <MemoryRouter initialEntries={['/client/ABC']}>
        <Routes>
          <Route path="/client/:roomCode" element={<App />} />
        </Routes>
      </MemoryRouter>
    )

    const SETUP_TIMEOUT_MS = 100
    await act(async () => { vi.advanceTimersByTime(SETUP_TIMEOUT_MS) })
    await act(async () => { if (mockWebSocket.onopen) mockWebSocket.onopen() })
    await act(async () => {
      mockWebSocket.onmessage?.({ data: JSON.stringify({ event: 'PLAYER_JOIN_ACK', data: { playerId: 'p1', reconnectToken: 'tk' } }) })
    })
    await act(async () => {
      mockWebSocket.onmessage?.({ data: JSON.stringify({ event: ROOM_STATE_UPDATE, data: { room: { phase: 'playing', players: [] } } }) })
    })
    await act(async () => {
      mockWebSocket.onmessage?.({ data: JSON.stringify({
        event: ROUND_CONTENT_SHOW,
        data: {
          type: 'balance-scale',
          answerChoices: [{ id: 'opt-a', text: 'Option A', submission: { optId: 'a' } }],
        }
      })})
    })
  }

  it('SCENARIO A - already-answered rejection locks the UI', async () => {
    await setupGame()
    
    await act(async () => {
      mockWebSocket.onmessage?.({ data: JSON.stringify({ event: 'ANSWER_ACK', data: { received: true, accepted: false, reason: 'already-answered' } }) })
    })

    const btn = screen.getByRole('button')
    expect(btn.hasAttribute('disabled')).toBe(true)
  })

  it('SCENARIO B - round-closed rejection does NOT lock the UI', async () => {
    await setupGame()
    
    await act(async () => {
      mockWebSocket.onmessage?.({ data: JSON.stringify({ event: 'ANSWER_ACK', data: { received: true, accepted: false, reason: 'round-closed' } }) })
    })

    const btn = screen.getByRole('button')
    expect(btn.hasAttribute('disabled')).toBe(false)
  })

  it('SCENARIO C - server-error rejection resets selection', async () => {
    await setupGame()
    
    const btn = screen.getByRole('button')
    fireEvent.click(btn)

    await act(async () => {
      mockWebSocket.onmessage?.({ data: JSON.stringify({ event: 'ANSWER_ACK', data: { received: true, accepted: false, reason: 'server-error' } }) })
    })

    expect(btn.hasAttribute('disabled')).toBe(false)
  })

  it('SCENARIO D - accepted submission behaves normally', async () => {
    await setupGame()
    
    const btn = screen.getByRole('button')
    fireEvent.click(btn)

    await act(async () => {
      mockWebSocket.onmessage?.({ data: JSON.stringify({ event: 'ANSWER_ACK', data: { received: true, accepted: true } }) })
    })

    expect(btn.hasAttribute('disabled')).toBe(true)
  })
})
