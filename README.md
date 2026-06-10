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
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how they fit together.

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

Full documentation lives in [`docs/`](docs/README.md). Start there for the
complete index. Highlights:

- [Getting started](docs/onboarding/GETTING_STARTED.md) — prerequisites, setup, daily commands
- [Architecture overview](docs/ARCHITECTURE.md) — how the system fits together
- [WebSocket protocol](docs/api/SOCKET_PROTOCOL.md) — the room/game wire format

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

## Setup

1. Clone the repository.
2. Open the repository folder in VS Code.
3. Install extensions when prompted.
4. Install docker + docker-buildx
5. Activate docker buildx
   `DOCKER_BUILDKIT=1`
6. Install dependencies:
   ```bash
   npm install --package-lock-only
   npm ci
   ```
7. Setup your environment and database:
   ```bash
   cp .env.example .env
   docker compose build
   docker compose up -d
   ```
   _(Make sure Docker is running on your machine before running `docker compose`)_

   Important: the `.env` file contains local secrets and must never be committed to
   the repository. The project already ignores `.env` files via `.gitignore`.

   If a secret is accidentally committed upstream, rotate the credential(s)
   immediately, remove the file from history (see maintainers), and have all
   collaborators re-clone the repository after the history has been rewritten.

## Server Access

To easily connect to the remote UVA server without a password prompt, we recommend storing the SSH key in your local `~/.ssh/` directory (e.g. `~/.ssh/brain-wiz-ssh`) rather than in the repository.

Add the following to your `~/.ssh/config`:

```ssh-config
Host brain
  HostName 83.96.203.127
  User ubuntu
  IdentityFile ~/.ssh/brain-wiz-ssh
  IdentitiesOnly yes
```

Ensure the key has the correct permissions (`chmod 400 ~/.ssh/brain-wiz-ssh`), then simply run:
```bash
ssh brain
```
## Deployment to uva server
1. Log in on the eduvpn of school.
2. First time connect to the uva server:
   - copy the file ssh key that is given by the group
   - `chmod 400 <ssh_key_file>`
3. Connect to server:
   `ssh -i <ssh_key_file> <name>@<ip>`
3. Setup the deployment script or if the script changed:
   - Copy the `deploy-uva.sh` script in the the home directory
   - `chmod +x deploy-uva.sh`
4. deploy the app:
   `./deploy-uva.sh`

## Workspace configuration

This repository includes strict, shared settings so everyone uses the same formatting and Git behavior:

- `.editorconfig` for whitespace, tabs/spaces, and final newline rules
- `.prettierrc` for consistent code formatting
- `.eslintrc.json` for linting rules and quality enforcement
- `.vscode/settings.json` for editor behavior in VS Code
- `.gitattributes` to force LF line endings and prevent cross-platform Git conflicts

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

## Generate the database schema

1. `docker compose up` make sure docker is running
2. Go to `http://localhost:5050`
3. On the left panel right click on server and click on register server and then server
4. Fill in the form:

- General:
  - Name: Brainwisdb

- Connection:
  - Host name/ Address : see docker-compose service name (default: db)
  - Port: see .env DB_PORT
  - Username: see .env DB_USERNAME
  - Password: see .env DB_PASSWORD

5. Open the toggle of server
6. right click on postgres
7. click on ERD for database
8. download the image

> The `.env` file holds local secrets and must never be committed. If a secret
> is committed upstream, rotate the credential(s) immediately, remove the file
> from history (ask a maintainer), and have collaborators re-clone after the
> history is rewritten.
