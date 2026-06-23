import type { SavedPlayer } from '../App.interfaces'

const STORAGE_KEY = 'brainwiz-player'

/** Read and validate persisted player credentials; null when absent or invalid. */
export function loadSavedPlayer(): SavedPlayer | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SavedPlayer>
    if (
      parsed.roomCode &&
      parsed.playerName &&
      parsed.playerId &&
      parsed.playerAvatar &&
      parsed.reconnectToken
    ) {
      return {
        roomCode: parsed.roomCode,
        playerName: parsed.playerName,
        playerId: parsed.playerId,
        playerAvatar: parsed.playerAvatar,
        reconnectToken: parsed.reconnectToken,
      }
    }
    return null
  } catch {
    return null
  }
}

/** Persist player credentials (best-effort; ignores private-mode/quota errors). */
export function saveSavedPlayer(creds: SavedPlayer): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(creds))
  } catch {
    /* ignore storage errors (private mode, quota) */
  }
}

/** Remove persisted player credentials (best-effort). */
export function clearSavedPlayer(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
