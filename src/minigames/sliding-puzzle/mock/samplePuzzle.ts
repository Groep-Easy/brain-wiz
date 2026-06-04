import {
  createSlidingPuzzle,
  type SlidingPuzzleImage,
  type SlidingPuzzlePuzzle,
} from '../shared/slidingPuzzleGame.js'
import { DEFAULT_SCRAMBLE_MOVES } from '../shared/slidingPuzzleGame.constants.js'

const LOCAL_TEST_IMAGE_URL = new URL('./images/local-test-puzzle.svg', import.meta.url).href

export const SAMPLE_SLIDING_PUZZLE_IMAGES: SlidingPuzzleImage[] = [
  {
    id: 'local-test-grid',
    url: LOCAL_TEST_IMAGE_URL,
    alt: 'Numbered color grid puzzle',
  },
]

export function getSampleSlidingPuzzle(index: number): SlidingPuzzlePuzzle {
  const image = SAMPLE_SLIDING_PUZZLE_IMAGES[index % SAMPLE_SLIDING_PUZZLE_IMAGES.length]
  if (!image) {
    throw new Error('No sample sliding-puzzle image is available')
  }

  return createSlidingPuzzle({
    id: `sample-sliding-puzzle-${index}`,
    image,
    scrambleMoves: DEFAULT_SCRAMBLE_MOVES,
  })
}
