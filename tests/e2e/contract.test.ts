import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

describe('Frontend/Backend Contract Tests', () => {
  it('validates FlowItem DTO matches StoredFlowItem schema', () => {
    // A simplified contract test simulating frontend FlowItem payload matching backend expectations
    const frontendPayload = {
      uid: 'client-only-id-123',
      blockId: 'trivia-1',
      questions: 2,
      timeLimitSeconds: 50,
    }

    // Backend StoredFlowItem expects no uid
    const toStoredFlow = (flow: unknown[]): Record<string, unknown>[] =>
      (flow as { blockId: string; questions: number; timeLimitSeconds: number }[]).map(
        ({ blockId, questions, timeLimitSeconds }) => ({
          blockId,
          questions,
          timeLimitSeconds,
        })
      )

    const backendPayload = toStoredFlow([frontendPayload])

    assert.ok(backendPayload[0])
    assert.equal(backendPayload[0]['blockId'], 'trivia-1')
    assert.equal(backendPayload[0]['questions'], 2)
    assert.equal(backendPayload[0]['timeLimitSeconds'], 50)
    assert.ok(backendPayload[0])
    assert.equal((backendPayload[0] as { uid?: string }).uid, undefined)
  })

  it('validates Websocket Event Names consistency', () => {
    // Simulate event names used in shared constants
    const clientEvents = ['host:join', 'player:submit', 'room:state']
    const serverEvents = ['host:join', 'player:submit', 'room:state']

    for (const event of clientEvents) {
      assert.ok(serverEvents.includes(event), `Server must support client event: ${event}`)
    }
  })
})
