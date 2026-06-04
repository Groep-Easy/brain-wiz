/**
 * @file game-event-bus.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { GameEventBus } from '../../src/server/room/game/game-event-bus'
import type { GameDomainEvent } from '../../src/server/room/game/game-events'

describe('GameEventBus', () => {
  it('delivers only events of the subscribed type', () => {
    const bus = new GameEventBus()
    const seen: GameDomainEvent[] = []
    bus.on('ROUND_SCORED').subscribe((e) => seen.push(e))

    bus.publish({ type: 'ALL_PLAYERS_ANSWERED', roomId: 'r', roundId: 'a' })
    bus.publish({ type: 'ROUND_SCORED', roomId: 'r', roundId: 'a' })

    assert.equal(seen.length, 1)
    assert.equal(seen[0]?.type, 'ROUND_SCORED')
  })

  it('does not replay events to late subscribers', () => {
    const bus = new GameEventBus()
    bus.publish({ type: 'ROUND_SCORED', roomId: 'r', roundId: 'a' })
    const seen: GameDomainEvent[] = []
    bus.on('ROUND_SCORED').subscribe((e) => seen.push(e))
    assert.equal(seen.length, 0)
  })
})
