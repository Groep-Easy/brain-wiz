import { isMuted } from './mute'

export const SFX = (source: string) => {
  if (isMuted()) return
  const rawData = new Audio(source)
  rawData.preload = 'auto'
  void rawData.play()
}
