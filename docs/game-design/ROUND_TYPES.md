# Round types

## Scope: 3 rounds at launch

| Round         | Type                                        | Dynamic                           |
| ------------- | ------------------------------------------- | --------------------------------- |
| Quiz          | Multiple choice, timed, individual scoring  | Questions from question bank      |
| Collab puzzle | All players work together toward one answer | Puzzle from puzzle bank           |
| Head-to-head  | Two players compete, rest watch             | Brainteaser from brainteaser bank |

## Adding a new round type

1. Add the type string to `ROUNDS.TYPES` in `src/shared/constants/game-config.ts` (git-master approval required).
2. Add server-side round logic in `src/server/game/rounds/<type>.ts`.
3. Add host display screen in `src/host/screens/<type>/`.
4. Add client screen in `src/client/screens/<type>/`.
5. Add socket events if needed — add to `src/shared/events/socket-events.ts` first.
6. Write tests for the server logic before opening the PR.
