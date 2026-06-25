# Round types

A game is a sequence of rounds. Every round has a **type**, and the type decides
what players see and how they score. There are two families.

## The two families

- **Quiz.** The classic multiple-choice question: a set of answers, a timer, and
  individual scoring. Questions come from the question bank.
- **Minigames.** Self-contained interactive rounds (a puzzle, a word game, a
  physics toy). They all run on one generic mechanism, so the round engine never
  has to know the rules of each game (see
  [how a minigame round works](#how-a-minigame-round-works)).

## Implemented round types

| Type             | What the player does                                   |
| ---------------- | ------------------------------------------------------ |
| `quiz`           | Pick the correct answer before the timer runs out.     |
| `sliding-puzzle` | Slide the tiles back into order.                       |
| `balance-scale`  | Choose the option that balances the scale.             |
| `vault-rush`     | Work out and enter the vault code under time pressure. |
| `wordle`         | Guess the hidden word from per-letter feedback.        |
| `light-switch`   | Flip switches until every light is on.                 |
| `bonk-air`       | Draw a launch plan, then watch it play out.            |

`collab-puzzle` and `head-to-head` are reserved in the `RoundType` union but are
not implemented yet.

Minigame implementation notes:

- [Sliding Puzzle](sliding-puzzle.md)
- [Balance Scale](balance-scale.md)
- [Vault Rush](vault-rush.md)

## How a minigame round works

The server drives every minigame through the same three messages, so adding a new
game never touches the round engine:

1. **`ROUND_CONTENT_SHOW`** carries the round's `publicState`, the puzzle as the
   players should see it. The host and client render it.
2. **`ROUND_PROGRESS` / `ROUND_SUBMIT`** carry the player's working and final
   answer back as an opaque `submission`.
3. **`ROUND_REVEAL`** carries the scored results plus the solution.

The engine treats `publicState` and `submission` as opaque; only the per-minigame
server adapter knows how to generate a puzzle and grade a submission. This is the
generic round contract on top of the [WebSocket layer](../architecture/websockets.md).

## Adding a new round type

1. Add the type string to `RoundType` in `src/shared/types/game.ts`.
2. Build the game in `src/minigames/<type>/`: the rules and types under `shared/`,
   the UI under `components/`.
3. Add a server adapter in `src/server/room/game/minigames/<type>.server.ts`
   (generate the puzzle, grade a submission) and register it in
   `minigame-registry.ts`.
4. Render it: add the type to the host `RoundMinigameSurface` map and the client
   `App` renderer map.
5. Unit-test the pure rules (generation and grading) before opening the PR.
