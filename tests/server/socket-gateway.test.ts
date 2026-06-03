/**
 * @file socket-gateway.test.ts
 * @owner server-squad
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SocketGateway } from '../../src/server/socket/socket.gateway.js'
import { PONG } from '../../src/shared/events/socket-events.js'

describe('SocketGateway ping/pong', () => {
  it('answers a ping with a pong envelope', () => {
    const gateway = new SocketGateway()
    const response = gateway.handlePing({ t: 1234 })
    assert.equal(response.event, PONG)
  })

  it('echoes the client timestamp back in the pong', () => {
    const gateway = new SocketGateway()
    const response = gateway.handlePing({ t: 1234 })
    assert.equal(response.data.t, 1234)
  })

  it('stamps a numeric server time on the pong', () => {
    const gateway = new SocketGateway()
    const response = gateway.handlePing({ t: 1234 })
    assert.equal(typeof response.data.serverTime, 'number')
  })

  it('defaults the echoed timestamp to 0 when the ping has no payload', () => {
    const gateway = new SocketGateway()
    const response = gateway.handlePing(undefined)
    assert.equal(response.data.t, 0)
  })
})
