/**
 * @file console-utils.ts
 * @owner host-squad
 * @description Types and pure helpers for the WebSocket debug console
 * (Console.tsx). Kept separate from the component so the logic is easy to scan
 * and reuse without React in the way.
 */
import { PONG } from '@shared/constants/socket-events.constants'

/** Direction of a log entry relative to the client. */
export type Direction = 'in' | 'out' | 'info'

/** Connection lifecycle states shown in the console. */
export type Status = 'closed' | 'connecting' | 'open'

/** A single line in the console message log. */
export interface LogEntry {
  id: number
  dir: Direction
  text: string
  time: string
}

/** If the frame is a PONG carrying an echoed `t`, return a " (RTT NNms)" note. */
export function rttNote(raw: string): string {
  try {
    const frame = JSON.parse(raw) as { event?: unknown; data?: { t?: unknown } }
    if (frame.event === PONG && typeof frame.data?.t === 'number') {
      return ` (RTT ${Date.now() - frame.data.t}ms)`
    }
  } catch {
    // not JSON — nothing to annotate
  }
  return ''
}

/** Build a ws:// URL with a query string from the given params. */
export function buildWsUrl(base: string, params: Record<string, string>): string {
  const url = new URL(base)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

/** Derive the HTTP base (for REST calls) from a ws:// / wss:// URL. */
export function wsToHttp(wsUrl: string): string {
  return wsUrl.replace(/^ws/i, 'http').replace(/\/+$/, '')
}

/** A decoded `{ event, data }` wire frame. */
export interface SocketFrame {
  event: string
  data: unknown
}

/** Parse a raw WebSocket frame into `{ event, data }`, or null if it isn't valid
 *  JSON with a string `event`. */
export function parseFrame(raw: string): SocketFrame | null {
  try {
    const frame = JSON.parse(raw) as { event?: unknown; data?: unknown }
    if (typeof frame.event === 'string') {
      return { event: frame.event, data: frame.data }
    }
  } catch {
    // not JSON — nothing to decode
  }
  return null
}

/** Parse a raw payload string as JSON, falling back to the raw string. */
export function parsePayload(rawData: string): unknown {
  const trimmed = rawData.trim()
  if (trimmed === '') {
    return undefined
  }
  try {
    return JSON.parse(trimmed)
  } catch {
    return rawData
  }
}
