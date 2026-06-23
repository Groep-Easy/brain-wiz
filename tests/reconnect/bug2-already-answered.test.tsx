import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { App } from '../../src/client/App'
import { ROUND_CONTENT_SHOW, ROOM_STATE_UPDATE } from '@brain-wiz/shared/constants/socket-events.constants'

describe('Bug 2: Already-Answered', () => {
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
  })

  async function setupGame() {
    sessionStorage.setItem('creds_ABC', JSON.stringify({ playerId: 'p1', reconnectToken: 'tk', playerName: 'Alice', roomCode: 'ABC' }))
    
    render(
      <MemoryRouter initialEntries={['/client/ABC']}>
        <Routes>
          <Route path="/client/:roomCode" element={<App />} />
        </Routes>
      </MemoryRouter>
    )

    await act(async () => { vi.advanceTimersByTime(100) })
    await act(async () => { if (mockWebSocket.onopen) mockWebSocket.onopen() })
    await act(async () => {
      mockWebSocket.onmessage({ data: JSON.stringify({ event: 'PLAYER_JOIN_ACK', data: { playerId: 'p1', reconnectToken: 'tk' } }) })
    })
    await act(async () => {
      mockWebSocket.onmessage({ data: JSON.stringify({ event: ROOM_STATE_UPDATE, data: { room: { phase: 'playing', players: [] } } }) })
    })
    await act(async () => {
      mockWebSocket.onmessage({ data: JSON.stringify({
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
      mockWebSocket.onmessage({ data: JSON.stringify({ event: 'ANSWER_ACK', data: { received: true, accepted: false, reason: 'already-answered' } }) })
    })

    const btn = screen.getByRole('button')
    expect(btn.hasAttribute('disabled')).toBe(true)
  })

  it('SCENARIO B - round-closed rejection does NOT lock the UI', async () => {
    await setupGame()
    
    await act(async () => {
      mockWebSocket.onmessage({ data: JSON.stringify({ event: 'ANSWER_ACK', data: { received: true, accepted: false, reason: 'round-closed' } }) })
    })

    const btn = screen.getByRole('button')
    expect(btn.hasAttribute('disabled')).toBe(false)
  })

  it('SCENARIO C - server-error rejection resets selection', async () => {
    await setupGame()
    
    const btn = screen.getByRole('button')
    fireEvent.click(btn)

    await act(async () => {
      mockWebSocket.onmessage({ data: JSON.stringify({ event: 'ANSWER_ACK', data: { received: true, accepted: false, reason: 'server-error' } }) })
    })

    expect(btn.hasAttribute('disabled')).toBe(false)
  })

  it('SCENARIO D - accepted submission behaves normally', async () => {
    await setupGame()
    
    const btn = screen.getByRole('button')
    fireEvent.click(btn)

    await act(async () => {
      mockWebSocket.onmessage({ data: JSON.stringify({ event: 'ANSWER_ACK', data: { received: true, accepted: true } }) })
    })

    expect(btn.hasAttribute('disabled')).toBe(true)
  })
})
