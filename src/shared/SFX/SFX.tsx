export const SOUNDS = Object.freeze({
  cardDrop: './card-drop.mp3',
  correct: './correct.mp3',
  die: './die.mp3',
  partyHorn: './party-horn.mp3',
  pop: './pop.mp3',
  quack: './quack.mp3',
  startGame: './start-game.mp3',
  waterDrop: './water-drop.mp3',
})

export function playSound(soundSource: string) {
  const audioData = new Audio(soundSource)
  // play() rejects when the browser blocks autoplay (no user gesture yet);
  // that's non-fatal for sound effects, so swallow it.
  audioData.play().catch(() => {
    /* ignore playback/autoplay errors */
  })
}
