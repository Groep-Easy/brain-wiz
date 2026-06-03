# Getting started

## Prerequisites

- Node.js 20 or newer — `node --version` to check
- npm 10 or newer
- VSCode with the recommended extensions (prompted on first open)

## First-time setup

```bash
git clone <repo-url>
cd brain-wis
cp .env.example .env
npm install
```

## Running the game

For a complete local setup including database services, test data seeding, and migrations, use the provided startup script:

```bash
./scripts/start.sh
```

Alternatively, if you already have the database running and migrated, you can use:

```bash
npm run dev
```

Host display (TV / laptop screen):

```
http://localhost:3000/host
```

Players open on their phone (same Wi-Fi network):

```
http://<host-ip>:3000
```

Find the host IP: `ipconfig` (Windows) or `ifconfig` / `ip a` (Mac/Linux).

## Tests, lint, format

```bash
npm run validate        # lint + format check + all tests (run before every commit)
npm test                # tests only
npm run lint:fix        # auto-fix lint errors
npm run format          # format all files
```

## Team rules — non-negotiable

1. **Edit only your squad's folder.** See `CODEOWNERS`.
2. **Never hardcode a socket event string.** Import from `src/shared/events/socket-events.js`.
3. **Never hardcode a game setting number.** Import from `src/shared/constants/game-config.js`.
4. **Changing `src/shared/` requires team notification before opening the PR.** It breaks all three contexts simultaneously.
5. **Every new logic path needs a test.** No test = PR rejected.
6. **Commit format:** `type(scope): description` e.g. `feat(server): add room expiry timer`
