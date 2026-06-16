/**
 * @file heartbeat-monitor.ts
 * @owner server-squad
 * @description Server-driven WebSocket heartbeat. The client-initiated PING is
 * for latency; it can't detect a half-open connection (e.g. a phone that goes
 * out of range without a clean close). This monitor pings every tracked socket
 * on an interval and terminates any that didn't answer the previous ping,
 * freeing roster slots and grace timers held by zombie sockets.
 *
 * Sockets that don't expose the `ws` ping/pong API (e.g. unit-test fakes) are
 * ignored, so the monitor is a no-op outside a real `ws` runtime.
 */
import 'reflect-metadata'
import { Injectable, Logger } from '@nestjs/common'
import { WS } from '@shared/constants/game-config.constants'
import type { HeartbeatSocket } from './socket.types'

@Injectable()
export class HeartbeatMonitor {
  private readonly logger = new Logger(HeartbeatMonitor.name)
  private readonly _sockets = new Set<HeartbeatSocket>()
  private _timer: NodeJS.Timeout | null = null

  /** Start tracking a socket. No-op for sockets without the ping/pong API. */
  public track(socket: HeartbeatSocket): void {
    if (typeof socket.ping !== 'function' || typeof socket.on !== 'function') {
      return
    }
    socket.isAlive = true
    socket.on('pong', () => {
      socket.isAlive = true
    })
    this._sockets.add(socket)
  }

  public untrack(socket: HeartbeatSocket): void {
    this._sockets.delete(socket)
  }

  /**
   * One heartbeat sweep: terminate sockets that missed the last ping, then ping
   * the survivors and mark them pending until their pong arrives. Public so it
   * can be driven directly in tests.
   */
  public reap(): void {
    for (const socket of [...this._sockets]) {
      if (socket.isAlive === false) {
        this._sockets.delete(socket)
        socket.terminate?.()
        continue
      }
      socket.isAlive = false
      socket.ping?.()
    }
  }

  /** Begin the periodic sweep (unref'd so it never holds the process open). */
  public start(): void {
    if (this._timer) {
      return
    }
    this._timer = setInterval(() => this.reap(), WS.HEARTBEAT_INTERVAL_MS)
    this._timer.unref()
    this.logger.log(`Heartbeat started (every ${WS.HEARTBEAT_INTERVAL_MS}ms)`)
  }

  public stop(): void {
    if (this._timer) {
      clearInterval(this._timer)
      this._timer = null
    }
  }
}
