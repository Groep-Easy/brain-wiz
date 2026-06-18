const STORAGE_KEY = 'host-muted'
const VOLUME_KEY = 'host-volume'
const DEFAULT_UNMUTE_VOLUME = 0.5

const muteListeners = new Set<(muted: boolean) => void>()
const volumeListeners = new Set<(volume: number) => void>()

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0
  return Math.min(1, Math.max(0, n))
}

function readStoredMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function readStoredVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_KEY)
    return raw === null ? 1 : clamp01(Number(raw))
  } catch {
    return 1
  }
}

let isMutedState = readStoredMuted()
let volumeState = readStoredVolume()

function applyToMedia(): void {
  document.querySelectorAll('audio, video').forEach((el) => {
    const media = el as HTMLMediaElement
    media.muted = isMutedState
    media.volume = volumeState
  })
}

function persistMuted(): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(isMutedState))
  } catch {
    // ignore storage failures (e.g. private mode)
  }
}

function persistVolume(): void {
  try {
    localStorage.setItem(VOLUME_KEY, String(volumeState))
  } catch {
    // ignore storage failures (e.g. private mode)
  }
}

export function isMuted(): boolean {
  return isMutedState
}

export function getVolume(): number {
  return volumeState
}

export function setMuted(next: boolean): void {
  isMutedState = next
  if (!isMutedState && volumeState === 0) {
    volumeState = DEFAULT_UNMUTE_VOLUME
    persistVolume()
    volumeListeners.forEach((fn) => fn(volumeState))
  }
  persistMuted()
  applyToMedia()
  muteListeners.forEach((fn) => fn(isMutedState))
}

export function toggleMuted(): void {
  setMuted(!isMutedState)
}

export function setVolume(next: number): void {
  volumeState = clamp01(next)
  const shouldMute = volumeState === 0
  const didMuteChange = shouldMute !== isMutedState
  isMutedState = shouldMute

  persistVolume()
  if (didMuteChange) persistMuted()
  applyToMedia()

  volumeListeners.forEach((fn) => fn(volumeState))
  if (didMuteChange) muteListeners.forEach((fn) => fn(isMutedState))
}

export function onMuteChange(fn: (muted: boolean) => void): () => void {
  muteListeners.add(fn)
  return () => muteListeners.delete(fn)
}

export function onVolumeChange(fn: (volume: number) => void): () => void {
  volumeListeners.add(fn)
  return () => volumeListeners.delete(fn)
}

export function watchMedia(): () => void {
  applyToMedia()
  const observer = new MutationObserver(() => applyToMedia())
  observer.observe(document.body, { childList: true, subtree: true })
  return () => observer.disconnect()
}
