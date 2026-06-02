/**
 * @file console-utils.ts
 * @owner host-squad
 * @description Types and pure helpers for the WebSocket debug console
 * (Console.tsx). Kept separate from the component so the logic is easy to scan
 * and reuse without React in the way.
 */
import { PONG } from '../../shared/events/socket-events'

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
