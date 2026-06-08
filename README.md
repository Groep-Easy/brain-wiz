# Brain Wiz

A multiplayer knowledge & puzzle game. A host display (TV or laptop screen)
shows the game. Players join from their phones using a room code anyone
with the code can join. Everything runs on a Node.js server that owns all game
state and talks to phones and the host over WebSockets.

```
[Phone 1] ──┐
[Phone 2] ──┤── WebSocket ──── [Node server] ──── [Host display]
[Phone N] ──┘
```

## Tech stack

- **Server:** Node.js + NestJS, native `ws` WebSockets, TypeORM + PostgreSQL
- **Host & client UIs:** React + TypeScript, built with Vite
- **Shared:** constants, types, and pure utilities imported by all three contexts

The repository is a monorepo with three runtime contexts plus shared code. See
[`docs/architecture/OVERVIEW.md`](docs/architecture/OVERVIEW.md) for how they fit
together.

## Quick start

```bash
git clone <repo-url>
cd brain-wis
cp .env.example .env
./scripts/start.sh
```

`./scripts/start.sh` installs dependencies, starts PostgreSQL via Docker, runs
migrations, and launches the dev server. Then open:

- **Host display:** http://localhost:3000/host
- **Players (phones):** `http://<host-ip>:3000` — for local dev, phones reach your
  machine over the LAN, so they need to be on the same network. (The deployed
  server is reachable by anyone with the room code.)

For prerequisites, the manual setup path, and troubleshooting, see
[**Getting started**](docs/onboarding/GETTING_STARTED.md).

## Documentation

| Doc                                                    | What it covers                                       |
| ------------------------------------------------------ | ---------------------------------------------------- |
| [Getting started](docs/onboarding/GETTING_STARTED.md)  | Prerequisites, setup, daily commands, team rules     |
| [Architecture overview](docs/architecture/OVERVIEW.md) | Runtime contexts, communication model, build steps   |
| [WebSocket protocol](docs/api/SOCKET_PROTOCOL.md)      | Event names, payloads, and the room/game wire format |
| [REST API](docs/api/REST_API.md)                       | HTTP endpoints for content management (questions)    |
| [QR-code flow](docs/api/QRCODE_FLOW.md)                | How room join codes and QR codes are generated       |
| [Round types](docs/game-design/ROUND_TYPES.md)         | Game round / minigame design                         |

## Prerequisites

- Node.js `>= 20.0.0`
- npm `>= 10.0.0`
- Docker (for the PostgreSQL database)
- Visual Studio Code (recommended)
- Git configured with your name and email

## Recommended VS Code extensions

Install the recommended extensions when prompted, or from
`.vscode/extensions.json`:

- `esbenp.prettier-vscode`
- `dbaeumer.vscode-eslint`
- `editorconfig.editorconfig`
- `christian-kohler.path-intellisense`
- `streetsidesoftware.code-spell-checker`
- `gruntfuggly.todo-tree`
- `eamodio.gitlens` (optional)

## Daily workflow

Run these before opening a PR:

- `npm run lint` — check for lint issues
- `npm run format:check` — verify formatting
- `npm run test` — run tests
- `npm run validate` — lint + format check + tests (the full pre-PR gate)

Fix issues automatically with:

- `npm run lint:fix`
- `npm run format`

## Workspace configuration

This repository ships strict, shared settings so everyone uses the same
formatting and Git behavior, minimizing conflicts:

- `.editorconfig` — whitespace, tabs/spaces, and final-newline rules
- `.prettierrc` — consistent code formatting
- `eslint.config.mjs` — linting rules and quality enforcement (flat config)
- `.vscode/settings.json` — editor behavior in VS Code
- `.gitattributes` — forces LF line endings to prevent cross-platform conflicts

Don't change these just for your local environment unless necessary. If you
modify lint/format rules, document the change here and in the config files.

## Git habits to avoid conflicts

- Run `git pull --rebase` before starting work.
- Keep feature branches small and focused.
- Rebase or merge `master` frequently when a branch is open for more than a day.
- Never commit generated/build artifacts or your `.env` file (already gitignored).

> The `.env` file holds local secrets and must never be committed. If a secret
> is committed upstream, rotate the credential(s) immediately, remove the file
> from history (ask a maintainer), and have collaborators re-clone after the
> history is rewritten.
