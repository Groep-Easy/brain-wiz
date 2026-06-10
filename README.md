# Brain Wiz

## Goal

This repository uses strict formatting, linting, and editor settings to minimize Git conflicts and keep a stable, shared workspace for all contributors.

## Prerequisites

- Node.js `>= 20.0.0`
- npm `>= 10.0.0`
- Visual Studio Code
- Git configured with your name and email

## Recommended VS Code extensions

Install the recommended extensions from `.vscode/extensions.json` or manually install:

- `esbenp.prettier-vscode`
- `dbaeumer.vscode-eslint`
- `editorconfig.editorconfig`
- `eamodio.gitlens` (optional)
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

## Workspace configuration

This repository includes strict, shared settings so everyone uses the same formatting and Git behavior:

- `.editorconfig` for whitespace, tabs/spaces, and final newline rules
- `.prettierrc` for consistent code formatting
- `.eslintrc.json` for linting rules and quality enforcement
- `.vscode/settings.json` for editor behavior in VS Code
- `.gitattributes` to force LF line endings and prevent cross-platform Git conflicts

## Daily workflow

Use these commands before opening a PR:

- `npm run lint` — check for lint issues
- `npm run format:check` — verify formatting
- `npm run test` — run tests
- `npm run validate` — run lint, formatting check, and tests

If you need to fix issues automatically:

- `npm run lint:fix`
- `npm run format`

## Git habits to avoid conflicts

- Always run `git pull --rebase` before starting work.
- Keep feature branches small and focused.
- Rebase or merge main frequently when your branch is open for more than a day.
- Do not commit generated or build artifacts.

## VS Code best practice

1. Use the workspace settings from `.vscode/settings.json`.
2. Keep `Editor: Format On Save` enabled.
3. Make sure Prettier is the default formatter for supported file types.
4. Accept recommended extensions and use them consistently.

## Important notes

- Do not change workspace settings just for your local environment unless absolutely necessary.
- If you modify lint/format rules, document the change in this README and in the config files.

## Validation

Run this before a PR or merge:

```bash
npm run validate
```

This consistent workflow helps all contributors stay aligned and prevents unnecessary Git conflicts.

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
