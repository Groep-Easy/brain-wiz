# Brain Wiz Architecture

This document explains how the architecture of Brain Wiz is put together: the runtime contexts, how
they communicate, how the server is structured internally, and the conventions
that keep the three contexts in sync.

This document is not the source of truth this will always be the code under [`src/`](../src). This document is only an extra information you can use for understanding it better.

---

## The big picture

Brain Wiz is a multiplayer game. A host display (a TV or laptop screen)
shows the game to the room, and players can join from their phones using a room
code. A single **Node.js server** owns all game state and talks to every device
over an websocket connection.

```
[Phone 1] ──┐
[Phone 2] ──┤── WebSocket ──── [Node server] ──── WebSocket ──── [Host display]
[Phone N] ──┘                       │
                                    │ TypeORM
                                    ▼
                              [PostgreSQL]
```

The key architectural decision: the server is authoritative. Phones and the
host display are thin views, they render whatever state the server pushes and
send user intent back. No game logic, scoring, or timing lives in the browser.
This keeps the game tamper-resistant (a player can't edit their score in the
client) and means there is exactly one place of truth where the game rules live.

---

## Runtime contexts

The repository is a monorepo with three runtime contexts plus a shared layer.
Each context is built and deployed differently, but they all speak the same
event and type vocabulary through `src/shared`.

| Context    | Location                      | Tech                            | Role                                                                     |
| ---------- | ----------------------------- | ------------------------------- | ------------------------------------------------------------------------ |
| **Server** | [`src/server`](../src/server) | Node.js + NestJS, `ws`, TypeORM | Authoritative game state, persistence, real-time orchestration.          |
| **Host**   | [`src/host`](../src/host)     | React + TypeScript (Vite)       | Read-only display shown on the shared screen (questions, leaderboard).   |
| **Client** | [`src/client`](../src/client) | React + TypeScript (Vite)       | The phone UI players use to join and answer.                             |
| **Shared** | [`src/shared`](../src/shared) | Plain TypeScript                | Constants, event names, types, and pure utilities imported by all three. |

There is also [`src/minigames`](../src/minigames) (self-contained interactive
round types such as the sliding puzzle and balance scale) and
[`src/config`](../src/config) (validated server/database configuration).

### Why a shared layer

The host, the client, and the server must agree on every event name and payload
shape, or messages silently fail. `src/shared` is the single source of truth for
that contract:

- [`shared/events/socket-events.ts`](../src/shared/events/socket-events.ts):
  every WebSocket event name as a named constant. **Never hardcode an event
  string elsewhere.** A change here intentionally applies to all three
  contexts, which is the point: the type checker of ts will catch the mismatches.
- [`shared/types`](../src/shared/types): payload and state types shared across
  the wire.
- [`shared/constants`](../src/shared/constants): game config (round defaults,
  WebSocket limits) used on both ends.
- [`shared/utils`](../src/shared/utils): pure functions (room-code generation,
  answer stats) safe to run anywhere.

Because everything here is pure and dependency-free, it is unit-tested in
isolation (`npm run test:shared`).

---

## How the contexts communicate

There are two channels, used for two different jobs:

### 1. HTTP REST — content management

The rest api is used for things which are not directly inside of the hot-loop of the game. This includes the management of questions. The api is guarded by a static admin API key (for know) to avoid the need for an whole authentication system but still keep it secure. See the [REST API](api/REST_API.md) doc for endpoints and auth.

### 2. WebSockets — live gameplay

Everything that happens during a game flow happens over websockets using the native `ws` transport layer (wired into the NestJS framework via `WsAdapter`). The host and every phone holds a persistent connection, which allows the server to push state changes (`ROOM_STATE_UPDATE`,`ROUND_START`, `LEADERBOARD_SHOW`, …) and receives intent (`PLAYER_JOIN`,
`ANSWER_SUBMIT`, …). The full event catalogue and payloads are in the
[WebSocket protocol](api/SOCKET_PROTOCOL.md) docs.

State that must survive a reconnect or a server restart lives in PostgreSQL via
TypeORM — see the [Data model](data-model/DATA_MODEL.md).

---

## Inside the server

The server is a NestJS application composed of feature modules. The root
[`AppModule`](../src/server/app.module.ts) only wires modules together, it holds
no business logic and `DatabaseModule` initializes first so repositories are
available to everyone else.

### Module map

| Module           | Responsibility                                                                  |
| ---------------- | ------------------------------------------------------------------------------- |
| `DatabaseModule` | TypeORM connection, entities, migrations, and the question seeder.              |
| `LobbyModule`    | Room/lobby orchestration. Owns the `SocketGateway` and connection-level guards. |
| `RoomModule`     | Persistence-facing operations for the `Room` entity.                            |
| `ClientModule`   | Persistence-facing operations for the `Client` (player) entity.                 |
| `GameModule`     | The round engine: round loop, round builder, scoring, answers, event bus.       |
| `RealtimeModule` | Shared realtime plumbing (live socket registry + wire broadcaster).             |
| `QuestionModule` | REST content management for questions.                                          |
| `QrcodeModule`   | QR / join-code generation for rooms.                                            |
| `HealthModule`   | Health-check endpoint.                                                          |

### Layering

The server follows a thin-edge / thick-core shape. Read it top to bottom:

```
WebSocket / HTTP edge   →  SocketGateway, REST controllers   (parse + delegate only)
        │
Orchestration           →  LobbyService, GameEngineService    (game rules, flow)
        │
Domain services         →  RoomService, ClientService,        (one concern each)
                           AnswerService, ScoringService
        │
Persistence             →  TypeORM repositories + entities     (the data model)
```

A few specifics worth knowing as a new contributor:

- **The gateway is a thin adapter.** [`SocketGateway`](../src/server/socket/socket.gateway.ts)
  parses the connection/message envelope and delegates all business logic to
  `LobbyService`. It subscribes to the shared event-name constants, never raw
  strings. The only logic it _does_ own is the connection-level concerns that
  can't live deeper: origin allow-listing, host-token brute-force throttling,
  idle-socket timeouts, per-connection rate limiting, a payload size cap, and a
  heartbeat that reaps dead sockets. Those guards live in
  [`src/server/socket`](../src/server/socket).
- **Realtime plumbing is extracted on purpose.** `RealtimeModule` holds the
  `ConnectionRegistry` (live socket lookup) and `RoomBroadcaster` (wire writes)
  so both the lobby and the game engine can broadcast without creating a
  dependency cycle between their modules.
- **Game events use an in-process bus.** [`GameEventBus`](../src/server/room/game/game-event-bus.ts)
  is a server-only rxjs pub/sub for domain events (e.g. "round finished"). It is
  never serialized to a socket don't confuse it with the WebSocket events in
  `shared/events`. It lets the engine decouple "something happened" from "who
  reacts to it" inside the server.
- **Config fails fast.** [`src/config`](../src/config) validates all server and
  database environment variables on startup and freezes the result, so a
  misconfiguration crashes immediately with a clear message rather than failing
  mid-game. Production forbids dangerous settings (e.g. `DB_SYNCHRONIZE`).

### A game's lifecycle, end to end

Tying the layers together with the flow a contributor will trace most often:

1. A host `POST`s to create a room (REST). `RoomService` persists a `Room` in
   `lobby` status; `QrcodeModule` generates the join code and QR.
2. Players open the join URL on their phones and open a WebSocket. The gateway
   validates the handshake and hands off to `LobbyService`, which creates a
   `Client` and broadcasts a `ROOM_STATE_UPDATE`.
3. The host starts the game. `GameEngineService` drives the round loop: it builds
   each `Round` from the content pool, opens it for answers, collects
   `ClientAnswer`s, then runs `ScoringService`.
4. After each round the server broadcasts results and the leaderboard; after the
   last round it emits `GAME_OVER` and records final ranks.

The persisted side of this is described in [Data model](data-model/DATA_MODEL.md);
the phase machine, timing, and scoring rules are in
[Game flow & scoring](gameplay/GAME_FLOW.md).

---

## Security boundaries

Security is enforced at the edges so the core can assume clean input:

- **Authoritative server.** Scores, timing, and correctness are computed
  server-side only, clients can't influence them.
- **REST admin key.** Content-management endpoints require a static
  `ADMIN_API_KEY`, it is required in production and falls back to a dev key
  otherwise (see [REST API](api/REST_API.md)).
- **CORS allow-list.** Cross-origin HTTP is restricted to configured origins.
  Production denies cross-origin by default unless `CORS_ORIGINS` is set.
- **WebSocket connection guards.** Origin allow-listing, host-token throttling,
  idle-connection timeouts, inbound rate limiting, a `maxPayload` cap, and a
  heartbeat all enforced at the gateway before any business logic runs.
- **Rate limiting.** The HTTP API (`@nestjs/throttler`) and the WebSocket
  connection are both rate-limited to prevent spam and abuse, with an additional
  limit at the nginx edge in production. See [Rate Limiting](security/rate-limiting.md).

---

## Build & run

The build produces one server bundle and two static front-ends, all under
`dist/` (gitignored):

| Command                           | What it builds / does                                         |
| --------------------------------- | ------------------------------------------------------------- |
| `npm run build`                   | Builds server, client, and host (the full `dist/`).           |
| `npm run build:server`            | Compiles the NestJS server with `nest build` → `dist/server`. |
| `npm run client:build`            | Vite build of the phone client → `dist/client`.               |
| `npm run host:build`              | Vite build of the host display → `dist/host`.                 |
| `npm run dev`                     | Watch-mode server (rebuild + restart on change).              |
| `npm run client:dev` / `host:dev` | Vite dev servers (ports 5173 / 5174) for the front-ends.      |
| `npm run start`                   | Runs the built server (`dist/server/index.js`).               |
| `npm run validate`                | The full pre-PR gate: lint + format check + tests.            |

The server entry point, [`src/server/index.ts`](../src/server/index.ts), is
intentionally thin: it bootstraps NestJS, installs the `ws` adapter, enables
CORS and the global validation pipe, and listens. For prerequisites and the
day-to-day workflow (Docker Postgres, migrations, the `scripts/start.sh`
helper), see [Getting started](onboarding/GETTING_STARTED.md).

---

## Where to go next

| You want to…                          | Read                                             |
| ------------------------------------- | ------------------------------------------------ |
| Run the project locally               | [Getting started](onboarding/GETTING_STARTED.md) |
| Understand the persisted data         | [Data model](data-model/DATA_MODEL.md)           |
| Understand the round engine & scoring | [Game flow & scoring](gameplay/GAME_FLOW.md)     |
| Send or handle a WebSocket message    | [WebSocket protocol](api/SOCKET_PROTOCOL.md)     |
| Add or edit content (questions, …)    | [REST API](api/REST_API.md)                      |
| Understand room joining & QR codes    | [QR-code flow](api/QRCODE_FLOW.md)               |
