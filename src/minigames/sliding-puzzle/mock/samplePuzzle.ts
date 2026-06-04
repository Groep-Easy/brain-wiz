import {
  createSlidingPuzzle,
  type SlidingPuzzleImage,
  type SlidingPuzzlePuzzle,
} from '../shared/slidingPuzzleGame.js'
import { DEFAULT_SCRAMBLE_MOVES } from '../shared/slidingPuzzleGame.constants.js'

const LOCAL_TEST_IMAGE_URL = '/src/minigames/sliding-puzzle/mock/images/local-test-puzzle.svg'

function createSampleSlidingPuzzleImages(
  localTestImageUrl = LOCAL_TEST_IMAGE_URL
): SlidingPuzzleImage[] {
  return [
    {
      id: 'local-test-grid',
      url: localTestImageUrl,
      alt: 'Numbered color grid puzzle',
    },
  ]
}

export const SAMPLE_SLIDING_PUZZLE_IMAGES: SlidingPuzzleImage[] = createSampleSlidingPuzzleImages()

export function getSampleSlidingPuzzle(
  index: number,
  localTestImageUrl = LOCAL_TEST_IMAGE_URL
): SlidingPuzzlePuzzle {
  const sampleImages = createSampleSlidingPuzzleImages(localTestImageUrl)
  const image = sampleImages[index % sampleImages.length]
  if (!image) {
    throw new Error('No sample sliding-puzzle image is available')
  }

  return createSlidingPuzzle({
    id: `sample-sliding-puzzle-${index}`,
    image,
    scrambleMoves: DEFAULT_SCRAMBLE_MOVES,
  })
}
