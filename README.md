<div align="center">
  <img src="assets/images/BrainWiz_logo.png" alt="Brain Wiz Logo" width="300" />
</div>

# Brain Wiz

Multiplayer knowledge & puzzle game. Host displays game. Players join via phones. Node.js server owns all state via WebSockets.

```text
[Phones] ── WebSocket ── [Node server] ── [Host display]
```

## Tech Stack

- **Server:** Node.js, NestJS, `ws`, TypeORM, PostgreSQL.
- **Clients:** React, TypeScript, Vite.
- **Shared:** Constants, types, pure utilities.

## Documentation Index

- **[Getting Started](docs/onboarding/GETTING_STARTED.md)** - Setup, run, and daily commands.
- **[Architecture](docs/architecture/OVERVIEW.md)** - Monorepo structure, build steps.
- **[WebSocket Protocol](docs/api/SOCKET_PROTOCOL.md)** - Events, connection limits, game loop.
- **[REST API](docs/api/REST_API.md)** - Room and question management.
- **[QR Code Flow](docs/api/QRCODE_FLOW.md)** - Join links and SVG generation.
- **[Round Types](docs/game-design/ROUND_TYPES.md)** - Game rounds and structure.

## Quick Start (Dev)

```bash
git clone https://github.com/Groep-Easy/brain-wiz.git
cd brain-wiz
cp .env.example .env
docker compose up -d
npm install
npm run dev
```

**Host:** `http://localhost:3000/host`
**Players:** `http://<host-ip>:3000`

## Deployment (UVA Server)

```bash
ssh -i <ssh_key_file> ubuntu@83.96.203.127
./deploy.sh prod  # Or ./deploy.sh dev
```

## Validation & PRs

```bash
npm run validate
```

_Fails if lint, format, or tests fail._

## Rules

- `.env` must not be committed.
- Rebase before work (`git pull --rebase`).
- Do not commit build artifacts.
