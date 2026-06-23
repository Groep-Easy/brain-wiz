import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { App } from '../../src/client/App'
import { RoomBroadcaster } from '../../src/server/room/lobby/room-broadcaster'
import { ConnectionRegistry } from '../../src/server/room/lobby/connection-registry'
import { QUESTION_SHOW, ROOM_STATE_UPDATE } from '@brain-wiz/shared/constants/socket-events.constants'
import type { ClientSocket } from '../../src/server/room/lobby/lobby.types.js'

describe('Bug 1: Ghost Answer', () => {
  it('SCENARIO A - player has a prior answer', () => {
    const registry = new ConnectionRegistry()
    const broadcaster = new RoomBroadcaster(registry)
    const socket = { send: vi.fn(), on: vi.fn(), close: vi.fn() } as unknown as ClientSocket & { send: ReturnType<typeof vi.fn> }
    const roomId = 'room-1'
    
    broadcaster.emitToRoom(roomId, QUESTION_SHOW, { question: { text: 'Q1' } })
    broadcaster.syncSocketState(roomId, socket, true, 'opt-b')
    
    expect(socket.send).toHaveBeenCalled()
    const payload = JSON.parse(socket.send.mock.calls[0][0])
    expect(payload.event).toBe(QUESTION_SHOW)
    expect(payload.data.alreadyAnswered).toBe(true)
    expect(payload.data.previousAnswerId).toBe('opt-b')
  })

  it('SCENARIO B - player has NOT answered yet', () => {
    const registry = new ConnectionRegistry()
    const broadcaster = new RoomBroadcaster(registry)
    const socket = { send: vi.fn(), on: vi.fn(), close: vi.fn() } as unknown as ClientSocket & { send: ReturnType<typeof vi.fn> }
    const roomId = 'room-1'
    
    broadcaster.emitToRoom(roomId, QUESTION_SHOW, { question: { text: 'Q1' } })
    broadcaster.syncSocketState(roomId, socket, false, undefined)
    
    const payload = JSON.parse(socket.send.mock.calls[0][0])
    expect(payload.event).toBe(QUESTION_SHOW)
    expect(payload.data.alreadyAnswered).toBeUndefined()
  })

  describe('Client State Handler', () => {
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

    it('SCENARIO C - client handler preserves state', async () => {
      // Mock session storage to bypass joining
      sessionStorage.setItem('creds_ABC', JSON.stringify({ playerId: 'p1', reconnectToken: 'tk', playerName: 'Alice', roomCode: 'ABC' }))
      
      render(
        <MemoryRouter initialEntries={['/client/ABC']}>
          <Routes>
            <Route path="/client/:roomCode" element={<App />} />
          </Routes>
        </MemoryRouter>
      )

      const SETUP_TIMEOUT_MS = 100
      await act(async () => {
        vi.advanceTimersByTime(SETUP_TIMEOUT_MS)
      })

      // Trigger socket onopen
      await act(async () => {
        if (mockWebSocket.onopen) mockWebSocket.onopen()
      })

      // Send PLAYER_JOIN_ACK to transition to joined=true
      await act(async () => {
        mockWebSocket.onmessage?.({ data: JSON.stringify({ event: 'PLAYER_JOIN_ACK', data: { playerId: 'p1', reconnectToken: 'tk' } }) })
      })

      // Send room state
      await act(async () => {
        mockWebSocket.onmessage?.({ data: JSON.stringify({ event: ROOM_STATE_UPDATE, data: { room: { phase: 'playing', players: [] } } }) })
      })

      // Send QUESTION_SHOW with alreadyAnswered
      await act(async () => {
        mockWebSocket.onmessage?.({ data: JSON.stringify({
          event: QUESTION_SHOW,
          data: {
            question: { text: 'Q1', type: 'multiple-choice', answers: [{ id: 'opt-b', text: 'Option B' }] },
            alreadyAnswered: true,
            previousAnswerId: 'opt-b'
          }
        })})
      })


      expect(screen.queryByText(/Locked in! Waiting for other players/i)).not.toBeNull()
    })

    it('SCENARIO D - client handler still resets state when alreadyAnswered is absent', async () => {
      sessionStorage.setItem('creds_ABC', JSON.stringify({ playerId: 'p1', reconnectToken: 'tk', playerName: 'Alice', roomCode: 'ABC' }))
      
      render(
        <MemoryRouter initialEntries={['/client/ABC']}>
          <Routes>
            <Route path="/client/:roomCode" element={<App />} />
          </Routes>
        </MemoryRouter>
      )

      const SETUP_TIMEOUT_MS = 100
      await act(async () => {
        vi.advanceTimersByTime(SETUP_TIMEOUT_MS)
      })

      await act(async () => {
        if (mockWebSocket.onopen) mockWebSocket.onopen()
      })

      await act(async () => {
        mockWebSocket.onmessage?.({ data: JSON.stringify({ event: 'PLAYER_JOIN_ACK', data: { playerId: 'p1', reconnectToken: 'tk' } }) })
      })

      await act(async () => {
        mockWebSocket.onmessage?.({ data: JSON.stringify({ event: ROOM_STATE_UPDATE, data: { room: { phase: 'playing', players: [] } } }) })
      })

      await act(async () => {
        mockWebSocket.onmessage?.({ data: JSON.stringify({
          event: QUESTION_SHOW,
          data: {
            question: { text: 'Q1', type: 'multiple-choice', answers: [{ id: 'opt-b', text: 'Option B' }] },
          }
        })})
      })

      // If not submitted, it should NOT say waiting for other players
      const waitMsg = screen.queryByText(/Locked in! Waiting for other players/i)
      expect(waitMsg).toBeNull()
    })
  })
})
