# Brain Wiz — WebSocket & room API

How the **host display** and the **phone client** talk to the server. This is the
contract as it exists today — events that are defined but not yet wired are
called out explicitly in [Reserved events](#reserved-events-not-yet-implemented).

- Transport: native **`ws`** WebSocket (not Socket.io).
- Server owns **all** state. Clients send actions; the server validates and
  broadcasts. The host is a **read-only subscriber** — it never sends game events.
- Source of truth for names/payloads:
  - Event names → `src/shared/events/socket-events.ts`
  - Payload types → `src/shared/types/index.ts`
  - Gateway (inbound handlers) → `src/server/socket/socket.gateway.ts`
  - REST room routes → `src/server/room/lobby/room.controller.ts`
  - Game/round loop (outbound game events) → `src/server/room/game/game-engine.service.ts`
  - Timings/round count → `src/shared/constants/game-config.ts` (`TIMER`, `ROUNDS`)

---

## 1. The wire format

Every WebSocket message — both directions — is a JSON envelope:

```json
{
  "event": "EVENT_NAME",
  "data": {
    /* payload, may be omitted */
  }
}
```

- `event` is always one of the constants in `socket-events.ts`. **Never hardcode
  the string** — import the constant.
- `data` is the typed payload for that event (see the tables below). Some events
  carry no payload.

```js
// sending
socket.send(JSON.stringify({ event: 'PLAYER_JOIN', data: { roomCode, playerName } }))

// receiving
socket.onmessage = (e) => {
  const { event, data } = JSON.parse(e.data)
  // switch on event…
}
```

---

## 2. Connecting

Default server URL (local dev): `ws://localhost:3000`

### Client (phone)

Open a plain socket, then send `PLAYER_JOIN`:

```js
const socket = new WebSocket('ws://localhost:3000')
socket.onopen = () => {
  socket.send(
    JSON.stringify({
      event: 'PLAYER_JOIN',
      data: { roomCode: 'ABCD', playerName: 'Alice' },
    })
  )
}
```

### Host (display)

The host authenticates on upgrade using the `Sec-WebSocket-Protocol` header
only. Tokens MUST NOT be sent in the URL query string (they leak to access
logs, browser history, referrers and proxies). The server requires two
subprotocols: the marker `WS_SUBPROTOCOL` and the host token. Example client
connect (JS):

```js
const socket = new WebSocket('ws://localhost:3000/?role=host&code=ABCD', [
  WS_SUBPROTOCOL,
  hostToken,
])
```

- `role=host`, `code` = room join code; `hostToken` = the token returned by
  `POST /rooms` (see [REST](#5-rest-room-lifecycle)).
- On success the host immediately receives a `ROOM_STATE_UPDATE`.
- If the code or token is wrong, the host is **not** registered and will be
  dropped by the idle timeout.

Security policy: any connection that supplies a `hostToken` in the URL query
string is rejected immediately. The server closes such sockets with WebSocket
close code `4001` and reason `"Unauthorized: invalid token transport"`.

> ⚠️ Connection rules every socket must respect — see
> [Connection rules & limits](#4-connection-rules--limits).

---

## 3. Events

Direction key: **C→S** client→server, **H→S** host→server, **S→C** server→one
socket, **S→all** server→everyone in the room (host + all clients).

### 3a. Client → server (inbound)

| Event          | Dir | Payload                                             | Notes                                                                                                              |
| -------------- | --- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `PLAYER_JOIN`  | C→S | `{ roomCode, playerName, playerId?, playerToken? }` | Fresh join, or reconnect when `playerId` + `playerToken` are supplied. Missing `roomCode`/`playerName` is ignored. |
| `PLAYER_LEAVE` | C→S | _none_                                              | Deliberate leave; removes the player.                                                                              |
| `PING`         | C→S | `{ t: number }`                                     | Liveness/latency probe. `t` is the client's timestamp.                                                             |

The host sends **no** events over the socket. Host actions (create / start a
game) go through REST.

### 3b. Server → client/host (outbound)

| Event                  | Dir   | Payload                                  | When                                                                                                                                         |
| ---------------------- | ----- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `ROOM_STATE_UPDATE`    | S→all | `{ room: RoomState }`                    | On host connect, and after any roster/state change. This is the full snapshot — **re-render from it**.                                       |
| `PLAYER_JOIN_ACK`      | S→C   | `{ playerId, roomCode, reconnectToken }` | Join/reconnect accepted. **Store `playerId` and `reconnectToken`** (see [Reconnecting](#reconnecting)).                                      |
| `PLAYER_JOIN_REJECTED` | S→C   | `{ reason: string }`                     | Join refused. See [reject reasons](#reject-reasons).                                                                                         |
| `PLAYER_DISCONNECTED`  | S→all | `{ playerId }`                           | A player's socket dropped (grace window started).                                                                                            |
| `PLAYER_RECONNECTED`   | S→all | `{ playerId }`                           | A player came back within the grace window.                                                                                                  |
| `GAME_START`           | S→all | _none_                                   | Host started the game; a `ROOM_STATE_UPDATE` follows, then the round loop begins. See [The game loop](#6-the-game-loop-round-state-machine). |
| `GAME_PHASE_CHANGE`    | S→all | `{ phase: GamePhase }`                   | The active round entered a new phase (`round-intro` → `playing` → `reveal`). A fresh `ROOM_STATE_UPDATE` carrying the same phase follows it. |
| `ROUND_START`          | S→all | `{ round: RoundSummary }`                | A new round began. Carries round index, total, type, and time limit (not the question content).                                              |
| `TIMER_TICK`           | S→all | `{ secondsRemaining: number }`           | Once per second during every timed phase, counting down. Hits `0` at expiry.                                                                 |
| `TIMER_EXPIRED`        | S→all | _none_                                   | The **question** phase's clock ran out. (Intro/reveal phases don't emit this — they just transition.)                                        |
| `ROUND_END`            | S→all | `{ scores: ScoreMap }`                   | The round finished. `scores` = each player's cumulative total at round end.                                                                  |
| `GAME_OVER`            | S→all | `{ finalScores: ScoreMap }`              | All rounds played; the room is finished. Carries each player's final cumulative total.                                                       |
| `PONG`                 | S→C   | `{ t, serverTime }`                      | Reply to `PING`. `t` is echoed; `serverTime` = server `Date.now()`.                                                                          |

#### Reject reasons

`PLAYER_JOIN_REJECTED.reason` is one of:
`Room not found` · `Game already started` · `Invalid reconnect token` ·
`Room is full` · `Display name is taken`.

### Payload shapes

```ts
RoomState    = { code: string; players: Player[]; phase: GamePhase; round: number }
Player       = { id: string; name: string; connected: boolean; score: number }
GamePhase    = 'lobby' | 'round-intro' | 'playing' | 'reveal' | 'leaderboard' | 'game-over'
RoundSummary = { index: number; total: number; type: RoundType; timeLimitSeconds: number }
RoundType    = 'quiz' | 'collab-puzzle' | 'head-to-head'
ScoreMap     = Record<string /* playerId */, number /* cumulative total */>
```

> The `GamePhase` type lists every phase the design allows, but the engine
> currently only drives a room through **`round-intro` → `playing` → `reveal`**
> (per round). `lobby` is the pre-start state; `leaderboard`/`game-over` are not
> emitted yet — end-of-game is signalled by the `GAME_OVER` **event** instead.
> Likewise `RoundType` is always `'quiz'` for now (quiz-only MVP).

(Full definitions in `src/shared/types/index.ts`.)

---

## 4. Connection rules & limits

These are enforced by the gateway — build the UIs to cooperate with them.

| Rule                  | Behaviour                                                                                                                                                                                                                       | What you must do                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Origin allow-list** | The server rejects (closes) a socket whose browser `Origin` isn't allow-listed. Allowed origins mirror the HTTP CORS list (`CORS_ORIGINS`; dev defaults: `http://localhost:5173` for client, `http://localhost:5174` for host). | Serve the apps from an allowed origin. In prod, add your origin to `CORS_ORIGINS`. |
| **Idle timeout**      | A socket that connects but never authenticates (host) or joins (client) within **30s** (`ROOM.JOIN_TIMEOUT_MS`) is closed.                                                                                                      | Send `PLAYER_JOIN` (or connect as host with valid params) promptly after `onopen`. |
| **Rate limit**        | Max **20 inbound messages/second per connection** (`RATE_LIMIT`). Excess messages are **dropped silently** (a dropped `PING` simply gets no `PONG`).                                                                            | Don't spam. Keep `PING` to ~once/sec.                                              |
| **Reconnect auth**    | Reclaiming an existing `playerId` requires the matching `reconnectToken`. A wrong/missing token is rejected with `Invalid reconnect token`.                                                                                     | Persist the token from `PLAYER_JOIN_ACK` and send it back on reconnect.            |

### Reconnecting

1. On every `PLAYER_JOIN_ACK`, save `playerId` **and** `reconnectToken`.
2. To reconnect (e.g. after a dropped socket, within the grace window), open a
   new socket and send `PLAYER_JOIN` with the stored `playerId` **and**
   `playerToken`:
   ```js
   socket.send(
     JSON.stringify({
       event: 'PLAYER_JOIN',
       data: { roomCode, playerName, playerId, playerToken: reconnectToken },
     })
   )
   ```
3. The token **rotates** on each successful reconnect — always overwrite your
   stored copy from the newest `PLAYER_JOIN_ACK`. The previous token will no
   longer work.

> Tokens are held in server memory: a **server restart invalidates all reconnect
> (and host) tokens**. After a restart, players must join fresh and the host must
> create a new room.

---

## 5. REST: room lifecycle

The host uses HTTP for room creation and starting the game.

| Method & path             | Body            | Returns / errors                                                                                             |
| ------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------ |
| `POST /rooms`             | _none_          | `{ code, hostToken }` — create a lobby. **Keep `hostToken` secret; never send it to players.**               |
| `GET /rooms/:code`        | _none_          | `RoomState`, or `404` if unknown.                                                                            |
| `POST /rooms/:code/start` | `{ hostToken }` | `RoomState` on success. `404` unknown room · `403` bad host token · `409` too few players / already started. |

Typical host flow:

```
POST /rooms                       → { code, hostToken }
open WS ?role=host&code&hostToken → receive ROOM_STATE_UPDATE
…players join over WS…
POST /rooms/:code/start {hostToken} → GAME_START + ROOM_STATE_UPDATE broadcast
```

---

## 6. The game loop (round state machine)

`POST /rooms/:code/start` flips the room out of the lobby, broadcasts
`GAME_START`, and kicks off a **server-authoritative loop** (`GameEngineService`).
The host and clients are pure subscribers — they never advance the state; they
react to the events the engine emits. The engine plays a fixed number of rounds
(`ROUNDS.COUNT`, currently **5**), all quiz rounds for the MVP.

### Per-round sequence

For each round the engine emits, in order:

```
ROUND_START                         { round: RoundSummary }
  ─ phase: round-intro ─────────────────────────────────────────
  GAME_PHASE_CHANGE  { phase: 'round-intro' }  +  ROOM_STATE_UPDATE
  TIMER_TICK …                      every 1s for ROUND_INTRO_SECONDS (3s)
  ─ phase: playing ─────────────────────────────────────────────
  GAME_PHASE_CHANGE  { phase: 'playing' }      +  ROOM_STATE_UPDATE
  (QUESTION_SHOW)                   ← reserved; presenter is still a stub
  TIMER_TICK …                      every 1s for QUESTION_SECONDS (30s)
  TIMER_EXPIRED                     question clock hit 0
  ─ phase: reveal ──────────────────────────────────────────────
  GAME_PHASE_CHANGE  { phase: 'reveal' }       +  ROOM_STATE_UPDATE
  TIMER_TICK …                      every 1s for REVEAL_SECONDS (5s)
ROUND_END                           { scores: ScoreMap }
```

After the last round:

```
GAME_OVER                           { finalScores: ScoreMap }
```

Notes for the UI:

- **Every `GAME_PHASE_CHANGE` is immediately followed by a `ROOM_STATE_UPDATE`**
  whose `room.phase` equals the new phase. You can drive the screen off either
  one — `ROOM_STATE_UPDATE` remains the full re-render snapshot.
- **`TIMER_TICK` counts down** (`secondsRemaining`) and fires during _every_
  timed phase — intro, question, and reveal. Only the question phase ends with
  an explicit `TIMER_EXPIRED`.
- Phase durations come from `TIMER` in `game-config.ts`
  (`ROUND_INTRO_SECONDS`, `QUESTION_SECONDS`, `REVEAL_SECONDS`).
- **Scoring isn't wired yet.** There is no `ANSWER_SUBMIT` handler and no
  scoring slice, so `ScoreMap` values in `ROUND_END`/`GAME_OVER` are currently
  all `0`. The shapes are stable; the numbers will become real when answering
  lands.

### Failure / teardown

- The loop is **fire-and-forget and never throws** at the caller. If something
  fails mid-game (e.g. fewer than `ROUNDS.COUNT` questions are seeded, which
  raises `NotEnoughQuestionsError`), the engine **abandons the room quietly** —
  the room is marked `ABANDONED` and **no client-facing event is sent**.
  ⚠️ This means `POST .../start` can return `200` and broadcast `GAME_START`,
  yet no `ROUND_START` ever arrives. Don't assume `GAME_START` guarantees a
  round will follow; gate the screen on the first `ROUND_START`/`GAME_PHASE_CHANGE`.
- If the room is torn down (everyone leaves) the in-flight phase is cancelled
  and the loop exits.

---

## 7. End-to-end flow (happy path)

```
HOST                         SERVER                         CLIENT (phone)
 │  POST /rooms                 │                                │
 │ ───────────────────────────>│                                │
 │  {code, hostToken}           │                                │
 │ <───────────────────────────│                                │
 │  WS ?role=host&code&token    │                                │
 │ ───────────────────────────>│                                │
 │  ROOM_STATE_UPDATE           │                                │
 │ <───────────────────────────│        WS connect              │
 │                              │ <──────────────────────────────│
 │                              │   PLAYER_JOIN {code, name}     │
 │                              │ <──────────────────────────────│
 │                              │   PLAYER_JOIN_ACK {id, token}  │
 │                              │ ──────────────────────────────>│
 │  ROOM_STATE_UPDATE  (S→all)  │   ROOM_STATE_UPDATE  (S→all)   │
 │ <────────────────────────────────────────────────────────────│
 │  POST /rooms/:code/start     │                                │
 │ ───────────────────────────>│                                │
 │  GAME_START (S→all) + ROOM_STATE_UPDATE                       │
 │ <────────────────────────────────────────────────────────────│
 │            ┌── per round (×ROUNDS.COUNT) ──────────────┐      │
 │  ROUND_START                                           │      │
 │  GAME_PHASE_CHANGE + ROOM_STATE_UPDATE  (intro)        │      │
 │  TIMER_TICK …                                          │      │
 │  GAME_PHASE_CHANGE + ROOM_STATE_UPDATE  (playing)      │      │
 │  TIMER_TICK … → TIMER_EXPIRED                          │      │
 │  GAME_PHASE_CHANGE + ROOM_STATE_UPDATE  (reveal)       │      │
 │  TIMER_TICK …                                          │      │
 │  ROUND_END                                             │      │
 │            └────────────────────────────────────────────┘     │
 │  GAME_OVER (S→all)                                            │
 │ <────────────────────────────────────────────────────────────│
```

---

## Reserved events (not yet implemented)

The game-flow and timer events (`GAME_PHASE_CHANGE`, `ROUND_START`, `ROUND_END`,
`GAME_OVER`, `TIMER_TICK`, `TIMER_EXPIRED`) are now wired — see
[The game loop](#6-the-game-loop-round-state-machine).

What's left are the **quiz-content and answer** events. They exist in
`socket-events.ts` but have **no live handler/broadcast yet** — don't rely on
them:

| Event             | Dir   | Why it's not live                                                                                                                                       |
| ----------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `QUESTION_SHOW`   | S→all | The engine reaches the `playing` phase, but the `RoundPresenter` is a stub (`StubRoundPresenter` just logs). The question-display slice will emit this. |
| `QUESTION_REVEAL` | S→all | Paired with `QUESTION_SHOW`; lands with the same slice.                                                                                                 |
| `ANSWER_SUBMIT`   | C→S   | No gateway handler yet — submitting an answer is silently ignored.                                                                                      |
| `ANSWER_ACK`      | S→C   | Lands with `ANSWER_SUBMIT` (and unblocks real scoring).                                                                                                 |

This document will grow as those land. When in doubt, the code in
`src/server/socket/`, `src/server/room/game/`, and `src/shared/` is authoritative.
