import jazz from './jazz.mp3'
import gameOver from './synthwave.mp3'
import suspense from './suspense.mp3'

import cardDrop from './card-drop.mp3'
import correct from './correct.mp3'
import die from './die.mp3'
import roundIntro from './intro.wav'
import leaderBoard from './leaderboard.mp3'
import partyHorn from './party-horn.mp3'
import pop from './pop.mp3'
import quack from './quack.mp3'
import startGame from './start-game.wav'
import waterDrop from './water-drop.mp3'
import wrong from './wrong.mp3'

export const sounds = {
  jazz,
  gameOver,
  suspense,
  cardDrop,
  correct,
  die,
  roundIntro,
  leaderBoard,
  partyHorn,
  pop,
  quack,
  startGame,
  waterDrop,
  wrong,
} as const

const _currentAudio = new Map<string, HTMLAudioElement>()

export function playSound(soundSource: string, loop: boolean) {
  let audioData = _currentAudio.get(soundSource)
  if (!audioData) {
    audioData = new Audio(soundSource)
    _currentAudio.set(soundSource, audioData)
  }

  audioData.loop = loop
  // play() rejects when the browser blocks autoplay (no user gesture yet);
  // that's non-fatal for sound effects, so swallow it.
  audioData.play().catch(() => {
    /* ignore playback/autoplay errors */
  })
}

export function stopSound(soundSource: string) {
  const audioData = _currentAudio.get(soundSource)
  if (audioData) {
    audioData.pause()
    audioData.currentTime = 0
    _currentAudio.delete(soundSource)
  }
}
