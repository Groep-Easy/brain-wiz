import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AnswerService } from '../../src/server/room/game/answer.service'

describe('Bug 4: Hostage Timer', () => {
  let bus: any
  let registry: any
  let broadcaster: any
  let answersRepo: any
  let service: any

  beforeEach(() => {
    bus = {
      on: vi.fn().mockReturnValue({ subscribe: vi.fn() }),
      publish: vi.fn()
    }
    registry = {
      lookup: vi.fn(),
      getClientSockets: vi.fn()
    }
    broadcaster = {
      emitToRoom: vi.fn(),
      emitToSocket: vi.fn()
    }
    answersRepo = {
      create: vi.fn().mockImplementation((x) => x),
      save: vi.fn().mockResolvedValue({})
    }
    service = new AnswerService(bus, registry, broadcaster, answersRepo)
  })

  // We need to trigger the ROUND_WINDOW_OPENED event to initialize the window
  function openWindow(roomId: string, roundId: string, options: any[]) {
    const callback = bus.on.mock.calls.find((c: any) => c[0] === 'ROUND_WINDOW_OPENED')
    const subscribeCb = callback[1] || bus.on.mock.results.find((r: any) => r.value.subscribe).value.subscribe.mock.calls[0][0]
    subscribeCb({ roomId, roundId, roundType: 'multiple-choice', scoringMode: 'quiz', shownAt: Date.now(), options })
  }

  it('SCENARIO A - all connected answered triggers round close early', async () => {
    const roomId = 'room-1'
    openWindow(roomId, 'round-1', [{ id: 'opt-a' }])

    const socket1 = {} as any
    const socket2 = {} as any
    registry.getClientSockets.mockReturnValue([socket1, socket2])

    // Player 1
    registry.lookup.mockReturnValueOnce({ roomId, clientId: 'p1', role: 'client' })
    await service.submit(socket1, { answerId: 'opt-a', timestamp: Date.now() })
    
    expect(bus.publish).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'ALL_PLAYERS_ANSWERED' }))

    // Player 2
    registry.lookup.mockReturnValueOnce({ roomId, clientId: 'p2', role: 'client' })
    await service.submit(socket2, { answerId: 'opt-a', timestamp: Date.now() })

    expect(bus.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'ALL_PLAYERS_ANSWERED', roomId, roundId: 'round-1' }))
  })

  it('SCENARIO B - disconnected players are ignored', async () => {
    const roomId = 'room-1'
    openWindow(roomId, 'round-1', [{ id: 'opt-a' }])

    const socket1 = {} as any
    const socket2 = {} as any
    // Only 2 sockets connected, even if room has 3 players
    registry.getClientSockets.mockReturnValue([socket1, socket2])

    registry.lookup.mockReturnValueOnce({ roomId, clientId: 'p1', role: 'client' })
    await service.submit(socket1, { answerId: 'opt-a', timestamp: Date.now() })

    registry.lookup.mockReturnValueOnce({ roomId, clientId: 'p2', role: 'client' })
    await service.submit(socket2, { answerId: 'opt-a', timestamp: Date.now() })

    expect(bus.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'ALL_PLAYERS_ANSWERED', roomId, roundId: 'round-1' }))
  })

  it('SCENARIO C - incomplete answers waits for timer', async () => {
    const roomId = 'room-1'
    openWindow(roomId, 'round-1', [{ id: 'opt-a' }])

    const socket1 = {} as any
    const socket2 = {} as any
    const socket3 = {} as any
    registry.getClientSockets.mockReturnValue([socket1, socket2, socket3])

    registry.lookup.mockReturnValueOnce({ roomId, clientId: 'p1', role: 'client' })
    await service.submit(socket1, { answerId: 'opt-a', timestamp: Date.now() })

    registry.lookup.mockReturnValueOnce({ roomId, clientId: 'p2', role: 'client' })
    await service.submit(socket2, { answerId: 'opt-a', timestamp: Date.now() })

    expect(bus.publish).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'ALL_PLAYERS_ANSWERED' }))
  })
})
