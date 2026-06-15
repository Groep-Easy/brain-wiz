import useSound from 'use-sound'
import { isMuted } from './mute'

export const Sound = (source: string) => {
  if (isMuted()) return
  const [play] = useSound(source, { preload: true })
  return play
}
