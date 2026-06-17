/**
 * @file Game.tsx
 * @owner client-squad
 * @description Sliding-puzzle minigame screen, served at /game. The puzzle now
 * ships as a first-class React component (src/minigames/sliding-puzzle), so this
 * screen simply renders its local mock harness instead of side-loading the old
 * standalone bundle.
 */
import type { JSX } from 'react'
import { SlidingPuzzleMock } from '@brain-wiz/minigames/sliding-puzzle/mock/SlidingPuzzleMock'

export function Game(): JSX.Element {
  return <SlidingPuzzleMock />
}
