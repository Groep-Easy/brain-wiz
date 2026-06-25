# Code Quality

We used the SIG (Sigrid) maintainability metrics as a worklist: pick a flagged
unit, refactor it so it reads and tests better, and keep the behaviour identical.
This page summarises what changed. For the cases where the metric over-reports,
see [SIG unit interface: observations](sig-unit-interface.md).

## How we worked

- **Metric-driven.** The Sigrid findings decided what to touch: too many
  parameters (unit interface), too many lines (unit size), and high McCabe
  complexity (unit complexity).
- **Behaviour-preserving.** These are refactors, not rewrites. Verified by
  `npm test` (lint + format + the full `tsc` build + the suite) and an explicit
  `tsc --noEmit` on the client and host projects.
- **Extracted to test.** Where a unit mixed pure logic with framework or IO, we
  pulled the pure part into its own module and unit-tested it. That added the
  first client- and host-side tests to the project.

## What we did

- **Parameter lists (unit interface).** Methods that took five or more arguments
  now take a single typed object: `joinClient` (7 to 2), `scoreQuiz` /
  `scoreMinigame`, `persistSubmission`, `connectHost`, `toFlowItem`.
- **Large units (unit size).** Split the ~470-line `scaleGame.ts` into
  physics / equations / generate / display behind a re-export barrel; turned
  `useClientSocket` (178 lines) and `useHostSocket` into thin hooks over pure
  reducers and message builders; pulled the flow-editor array logic into
  `flowMutations`. The reducers, builders, and transforms are unit-tested.
- **Complexity (McCabe).** Replaced long branch chains with lookup maps (the
  minigame and phase switches in the client/host `App`, `RoundMinigameSurface`,
  `MinigameDynamicGrid`) and extracted branch clusters into small helpers
  (`buildSerpentine`, `clientIp`, `seedQuestions`).
- **Coupling (architecture).** Split the highest-churn file in the repo,
  `src/shared/types/index.ts`, into per-feature modules behind a re-export barrel,
  so a change touches only its slice.

## Two examples

### A parameter object

`LobbyService.joinClient` took seven positional arguments, five of which were
exactly the `PLAYER_JOIN` payload. Bundling them cleared the finding and made the
call self-describing (no more guessing which `string` is the room code):

```ts
// before
joinClient(socket, connectionId, roomCode, playerName, playerId, playerToken, playerAvatar)

// after
joinClient(socket, request) // request: JoinClientRequest
```

### A switch replaced by a lookup map

Minigame rendering was a chain of `if (content.type === ...)`. Each branch became
a small renderer dispatched through a map, so the component is a one-line lookup
and adding a minigame no longer raises its complexity:

```ts
const SURFACE_RENDERERS = {
  'balance-scale': renderBalanceScale,
  'sliding-puzzle': renderSlidingPuzzle,
  // ...one entry per minigame
}
const render = SURFACE_RENDERERS[content.type]
return render ? render(ctx) : null
```

## Verification

`npm test` (lint, format, full `tsc` build, the test suite) plus `tsc --noEmit`
on the client and host projects. Everything stayed green after each change.
