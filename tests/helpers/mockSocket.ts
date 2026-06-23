import { vi } from 'vitest'

export class MockSocket {
  public send = vi.fn()
  public close = vi.fn()
  public onopen: (() => void) | null = null
  public onclose: ((event: unknown) => void) | null = null
  public onmessage: ((event: { data: string }) => void) | null = null
  public onerror: (() => void) | null = null
  public readyState = 1 // OPEN

  public simulateClose(event: unknown = {}): void {
    if (this.onclose) {
      this.onclose(event)
    }
  }

  public simulateMessage(event: string, payload: unknown): void {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify({ event, data: payload }) })
    }
  }
}
