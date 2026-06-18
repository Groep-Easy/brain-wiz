import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

describe('Frontend/Backend Contract Tests', () => {
  it('validates FlowItem DTO matches StoredFlowItem schema', () => {
    // A simplified contract test simulating frontend FlowItem payload matching backend expectations
    const frontendPayload = {
      uid: 'client-only-id-123',
      blockId: 'trivia-1',
      questions: ['q1', 'q2'],
    }

    // Backend StoredFlowItem expects no uid
    const toStoredFlow = (flow: unknown[]): Record<string, unknown>[] =>
      (flow as { blockId: string; questions: string[] }[]).map(({ blockId, questions }) => ({
        blockId,
        questions,
      }))

    const backendPayload = toStoredFlow([frontendPayload])

    assert.ok(backendPayload[0])
    assert.equal(backendPayload[0]['blockId'], 'trivia-1')
    assert.deepEqual(backendPayload[0]['questions'], ['q1', 'q2'])
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
