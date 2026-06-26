# Balance Scale

Implementation notes for the server-backed `balance-scale` round.

## Main Files

- `src/server/room/game/minigames/balance-scale.server.ts` creates rounds, removes private answer data from public state, maps answer choices, and scores submissions.
- `src/minigames/balance-scale/shared/scaleGame.generate.ts` builds generated puzzles from item pools and layout variants.
- `src/minigames/balance-scale/shared/scaleGame.physics.ts` contains the torque and balance math.
- `src/minigames/balance-scale/shared/scaleGame.equations.ts` builds the visual equation clues.
- `src/minigames/balance-scale/shared/scaleGame.display.ts` decides what items are shown while answering and during reveal.
- `src/minigames/balance-scale/components/BalanceScale.tsx` renders the SVG scale.
- `src/minigames/balance-scale/components/ScaleEquationClues.tsx` renders the equation clues next to the scale.
- `src/minigames/components/RoundMinigameSurface.tsx` plugs the scale into the generic minigame surface.

## Round State

The key contract is the public/private split. The correct answer must not be sent with `ROUND_CONTENT_SHOW`.

`publicState` contains:

- `id`
- `placed`
- `addTo`
- `options`
- `equations`

`publicState` does not contain:

- `correctOptionId`

`privateState` contains:

- `correctOptionId`

Submissions use:

- `{ optionId: string }`

Reveal sends:

- `publicSolution: { correctOptionId }`

`RoundMinigameSurface` merges `publicSolution.correctOptionId` back into the puzzle only during reveal. That lets the reveal UI show the correct item without leaking it during the answering phase.

## Generation

`BalanceScaleServerAdapter.createRound` picks the difficulty from the round index:

- first two balance-scale rounds are `easy`
- later rounds are `hard`

The adapter chooses an item pool with `getDefaultScaleItemPool(hashSeed(input.seed), difficulty)` and then calls `generateScalePuzzle`.

Generation uses fixed layout variants instead of free-form random placement. That keeps the puzzle readable and gives tests a stable shape to assert:

- easy uses `3` item types and `2` equation clues
- hard uses `4` item types and `3` equation clues
- all generated placements currently use `GENERATED_SCALE_SLOT = 2`

`generateScalePuzzle` sorts the item pool by weight, picks a stable variant from the seed/id, builds placed items, creates equations, finds the balancing option, and validates the result. If no option balances the generated scale, generation throws instead of creating a broken round.

## Client Flow

`BalanceScale.tsx` is display-only. It renders the current scale state and the question marker, but it does not own answer selection.

Answer buttons come from `BalanceScaleServerAdapter.getAnswerChoices(publicState)`. Each option becomes a normal round answer choice with this submit payload:

- `{ optionId: id }`

While answering, `getDisplayedItems` returns only `puzzle.placed`, so the missing item stays hidden. During reveal, `RoundMinigameSurface` adds the revealed `correctOptionId`, and `getDisplayedItems` adds that option to `puzzle.addTo` with `isNew: true`.

`ScaleEquationClues` reads `puzzle.equations`. It can be hidden through the surface prop, but the normal minigame surface shows it.

## Scoring

The adapter validates that the submission has a non-empty `optionId`. It then compares that id with `privateState.correctOptionId`.

Current scoring:

- correct answer gets `700` base points
- correct answer can also get up to `300` speed bonus
- wrong answer gets `0`
- speed bonus is clamped to the round time

The correct answer for reveal always comes from private state, not from public state.

## Tests

`tests/server/balance-scale-server-adapter.test.ts` covers the server contract:

- `correctOptionId` is not present in public state
- private state keeps the correct option
- scoring reveals the correct option from private state
- public item options map to answer choices with `{ optionId }` submissions

Useful follow-up tests if this changes:

- easy/hard generation returns the expected equation counts
- generated puzzles always include exactly one correct option
- reveal rendering adds the correct item only during reveal

## Change Notes

Do not put `correctOptionId` back into `publicState`. The public answer options are fine, but the id of the correct one belongs in private state until scoring/reveal.

Keep `scaleGame.physics.ts` pure. It should stay reusable by generation, tests, and UI without depending on sockets, rooms, browser APIs, or database state.

If item pools or weights change, run the generator tests or add coverage first. The fixed variants assume the sorted weights make a positive balancing option.
