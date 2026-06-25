# Sliding Puzzle

Implementation notes for the server-backed `sliding-puzzle` round.

## Main Files

- `src/server/room/game/minigames/sliding-puzzle.server.ts` creates the round, validates submissions, scores boards, and returns the reveal solution.
- `src/minigames/sliding-puzzle/shared/slidingPuzzleGame.ts` contains the board math, seeded scrambling, local solver, and scoring helper.
- `src/minigames/sliding-puzzle/components/SlidingPuzzle.tsx` owns the interactive board UI.
- `src/minigames/components/slidingPuzzleAutoSubmit.ts` handles progress updates and auto-submit.
- `src/minigames/components/RoundMinigameSurface.tsx` renders the puzzle inside the generic host/client minigame surface.
- `src/minigames/components/MinigameDynamicGrid.tsx` is the client-side minigame renderer used by the older dynamic grid path.

## Round State

`publicState` is what the client and host receive when the round starts:

- `id`
- `image: { id, url, alt }`
- `initialBoard: number[]`

The current adapter uses `/client/minigames/local-test-puzzle.svg` as the image. That is still a local default. If we later move puzzle images into stored content, the adapter should pass the content image into `createSlidingPuzzle` instead of using `DEFAULT_IMAGE`.

`privateState` currently stores:

- `solutionBoard: SOLVED_BOARD`

The solved board is fixed for the current 3x3 puzzle, so scoring still compares against `SOLVED_BOARD`. If we ever support variable board layouts or custom solutions, `scoreSubmission` should read the solution from `privateState` instead of using the constant directly.

Submissions use:

- `{ board: number[] }`

Reveal sends:

- `publicSolution: { board: SOLVED_BOARD }`

## Generation

`SlidingPuzzleServerAdapter.createRound` calls `createSlidingPuzzle` with the round id, seed, and image metadata. The shared generator uses `createSeededRandom(seed)` when a seed is available, then scrambles from `SOLVED_BOARD`.

The board is always a 3x3 board right now:

- `BOARD_SIZE = 3`
- `SOLVED_BOARD = [1, 2, 3, 4, 5, 6, 7, 8, 0]`
- `DEFAULT_SCRAMBLE_MOVES = 80`

The scramble function moves the blank tile repeatedly, so the result stays solvable. It also retries if the scramble lands back on the solved board.

## Client Flow

`SlidingPuzzle.tsx` keeps the current board in component state. A tile can move only when it is adjacent to the blank `0` tile. The component calls `onBoardChange(board)` after the player moves a tile, after reset, and during the local solver path.

On the client path, `handleSlidingPuzzleBoardUpdate` sends `onProgress({ board })` for every valid board change while the round is still playing. It only calls `onSubmit({ board })` when the board is solved. The round system can keep the latest partial board without forcing a final submission before the player solves the puzzle.

Host display is read-only. During reveal or after submit, the client puzzle is also read-only.

## Scoring

The server adapter validates that a submission board is a permutation of `0..8`. Invalid shapes get `0` points.

Scoring is handled by `scoreSlidingPuzzleBoard`:

- `100` points per correctly placed non-blank tile.
- Blank tile `0` does not count as a correct tile.
- Speed bonus is only awarded when the board is solved.
- Current speed bonus max is `300`, scaled by remaining time.

With the current config, a fully solved board can score `800 + up to 300`. An unfinished board can still get position points, but never gets the speed bonus.

## Tests

`tests/server/sliding-puzzle-server-adapter.test.ts` covers the server scoring path:

- solved board gets position points plus speed bonus
- unfinished board gets position points only

Useful follow-up tests if this changes:

- invalid boards are rejected
- seeded round creation is stable
- reveal returns the solved board

## Change Notes

Keep the board rules in `shared/slidingPuzzleGame.ts`. The server adapter should stay focused on round state, submission validation, and scoring. The UI does not need room state, private state, or score calculation.

If the board size changes, check `TILE_BACKGROUND_STEP_PERCENT`, the board validation, the solved board constant, and the SVG/background positioning together.
