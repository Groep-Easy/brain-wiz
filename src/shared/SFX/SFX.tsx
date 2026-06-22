//import jazz from './jazz.mp3'
import gameOver from './synthwave.mp3'
import suspense from './Standoff.mp3'

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

function playSound(soundSource: string) {
  const audioData = new Audio(soundSource)
  // play() rejects when the browser blocks autoplay (no user gesture yet);
  // that's non-fatal for sound effects, so swallow it.
  audioData.play().catch(() => {
    /* ignore playback/autoplay errors */
  })
}

export function gameOverSound() {
  playSound(gameOver)
}

export function suspenseSound() {
  playSound(suspense)
}

export function cardDropSound() {
  playSound(cardDrop)
}

export function correctSound() {
  playSound(correct)
}

export function dieSound() {
  playSound(die)
}

export function roundIntroSound() {
  playSound(roundIntro)
}

export function leaderBoardSound() {
  playSound(leaderBoard)
}

export function partyHornSound() {
  playSound(partyHorn)
}

export function popSound() {
  playSound(pop)
}

export function quackSound() {
  playSound(quack)
}

export function startGameSound() {
  playSound(startGame)
}

export function waterDropSound() {
  playSound(waterDrop)
}

export function wrongSound() {
  playSound(wrong)
}
