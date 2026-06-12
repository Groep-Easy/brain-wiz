const STORAGE_KEY = 'host-muted'

const listeners = new Set<(muted: boolean) => void>()

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

let isMutedState = readStored()

function applyToMedia(): void {
  document.querySelectorAll('audio, video').forEach((el) => {
    ;(el as HTMLMediaElement).muted = isMutedState
  })
}

export function isMuted(): boolean {
  return isMutedState
}

export function setMuted(next: boolean): void {
  isMutedState = next
  try {
    localStorage.setItem(STORAGE_KEY, String(next))
  } catch {
    // ignore storage failures (e.g. private mode)
  }
  applyToMedia()
  listeners.forEach((fn) => fn(isMutedState))
}

export function toggleMuted(): void {
  setMuted(!isMutedState)
}

export function onMuteChange(fn: (muted: boolean) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function watchMedia(): () => void {
  applyToMedia()
  const observer = new MutationObserver(() => applyToMedia())
  observer.observe(document.body, { childList: true, subtree: true })
  return () => observer.disconnect()
}
