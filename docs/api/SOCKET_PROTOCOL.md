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

The host authenticates **on the upgrade URL** with query params and then only
listens:

```
ws://localhost:3000/?role=host&code=ABCD&hostToken=<token>
```

- `role=host`, `code` = room join code, `hostToken` = the token returned by
  `POST /rooms` (see [REST](#5-rest-room-lifecycle)).
- On success the host immediately receives a `ROOM_STATE_UPDATE`.
- If the code or token is wrong, the host is **not** registered (it silently
  receives nothing) and will be dropped by the idle timeout.

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

| Event                  | Dir   | Payload                                  | When                                                                                                    |
| ---------------------- | ----- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `ROOM_STATE_UPDATE`    | S→all | `{ room: RoomState }`                    | On host connect, and after any roster/state change. This is the full snapshot — **re-render from it**.  |
| `PLAYER_JOIN_ACK`      | S→C   | `{ playerId, roomCode, reconnectToken }` | Join/reconnect accepted. **Store `playerId` and `reconnectToken`** (see [Reconnecting](#reconnecting)). |
| `PLAYER_JOIN_REJECTED` | S→C   | `{ reason: string }`                     | Join refused. See [reject reasons](#reject-reasons).                                                    |
| `PLAYER_DISCONNECTED`  | S→all | `{ playerId }`                           | A player's socket dropped (grace window started).                                                       |
| `PLAYER_RECONNECTED`   | S→all | `{ playerId }`                           | A player came back within the grace window.                                                             |
| `GAME_START`           | S→all | _none_                                   | Host started the game; a `ROOM_STATE_UPDATE` follows.                                                   |
| `PONG`                 | S→C   | `{ t, serverTime }`                      | Reply to `PING`. `t` is echoed; `serverTime` = server `Date.now()`.                                     |

#### Reject reasons

`PLAYER_JOIN_REJECTED.reason` is one of:
`Room not found` · `Game already started` · `Invalid reconnect token` ·
`Room is full` · `Display name is taken`.

### Payload shapes

```ts
RoomState  = { code: string; players: Player[]; phase: GamePhase; round: number }
Player     = { id: string; name: string; connected: boolean; score: number }
GamePhase  = 'lobby' | 'round-intro' | 'playing' | 'reveal' | 'leaderboard' | 'game-over'
```

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

## 6. End-to-end flow (happy path)

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
```

---

## Reserved events (not yet implemented)

These names exist in `socket-events.ts` for the upcoming game-flow work but have
**no server handler/broadcast yet** — don't rely on them:

`GAME_PHASE_CHANGE` · `ROUND_START` · `ROUND_END` · `GAME_OVER` ·
`QUESTION_SHOW` · `QUESTION_REVEAL` · `ANSWER_SUBMIT` · `ANSWER_ACK` ·
`TIMER_TICK` · `TIMER_EXPIRED`

This document will grow as those land. When in doubt, the code in
`src/server/socket/` and `src/shared/` is authoritative.
