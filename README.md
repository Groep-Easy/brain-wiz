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
npm install

# Start database infrastructure
docker compose up -d db

# Start application watchers
npm run dev

# Reset local database if needed
npm run db:reset
```

**During Local Development (`npm run dev`)**:

- **Host Display:** `http://localhost:5174/host` (Vite dev server)
- **Players (Client):** `http://localhost:5173/client` (Vite dev server)
- **Backend API:** `http://localhost:3000/api` (NestJS)

**During Production / Built Mode (`npm run build` & `npm run start`)**:

- **Host Display:** `http://<server-ip>/host`
- **Players (Client):** `http://<server-ip>/client`
- All frontend assets are statically served by the NestJS server on port 3000, proxied via Nginx.

## Deployment (Production/Server)

The whole app (host, client, server) is one Node process, fronted by nginx and
backed by Postgres — all defined in a single `docker-compose.yml`. Optional
extras are opt-in via profiles (`tools` = pgAdmin, `observability` = Loki/
Promtail/Grafana).

**One-time setup on a fresh host:**

```bash
ssh <user>@<server-ip>
git clone https://github.com/Groep-Easy/brain-wiz.git ~/brain-wiz && cd ~/brain-wiz
cp .env.example .env        # then edit: set NODE_ENV=production, real secrets,
                            # and CORS_ORIGINS=https://<server-ip-or-domain>
make cert                   # generate the self-signed TLS cert (once)
```

**Deploy / redeploy (pull latest + rebuild + restart):**

```bash
make deploy                 # core stack: app + nginx + db
make deploy-obs             # core stack + observability (Loki/Promtail/Grafana)
```

`make deploy` uses `-f docker-compose.yml` explicitly, so the local-dev
`docker-compose.override.yml` is never applied on the server (the DB stays
internal). After deploy: app at `https://<server-ip>`, host at `/host`,
client at `/client`. The cert is self-signed — click **Advanced → Proceed**.

## Validation & PRs

```bash
npm run validate
```

_Fails if lint, format, or tests fail._

## Rules

- `.env` must not be committed.
- Rebase before work (`git pull --rebase`).
- Do not commit build artifacts.

## Acknowledgements

- **Animated Backgrounds:** Adapted from [gradients-bg](https://github.com/baunov/gradients-bg).
- **Glassmorphism:** Styled referencing Apple's VisionOS/Material liquid glass UI.
- Detailed tracking can be found in `docs/PLAGIARISM.md`.
