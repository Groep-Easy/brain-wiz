# WebSocket Connection Hardening

All gameplay runs over a single long-lived WebSocket connection, so the
connection itself is an attack surface that is separate from the messages
travelling over it. On top of the per-message rate limiting and input validation
(each has its own doc), we also harden the connection. That means controlling
who is allowed to open one, how large a single message can be, and how we clean
up connections that stop behaving.

## What we implemented

### Origin allow-listing

A browser always sends an `Origin` header on the WebSocket upgrade, so we use it
to block cross-site WebSocket hijacking (CSWSH). A socket opened from a page we
don't trust is refused before anything else happens. The `ws` transport runs in
`noServer` mode because it shares Nest's HTTP server, which means ws's own
`verifyClient` hook never fires, so we run the check in the gateway's connection
handler instead.

The rules are simple. If an `Origin` is present it has to be on the allow-list,
otherwise the socket is closed straight away. If there is no `Origin` at all the
connection is allowed, since non-browser clients are not a CSWSH vector. During
local development the allow-list also accepts private network addresses
(`192.168.x`, `10.x`, `172.x`) so developers can test the client on their
phones.

### Maximum message size

The gateway sets a `maxPayload` of 16 KB. The `ws` library drops any frame
larger than that, which stops a single client from sending an oversized message
to exhaust server memory.

### Join timeout for idle sockets

When a socket connects we start a 30-second timer. If it has not joined a room
or authenticated as a host by the time the timer fires, we close it. This keeps
sockets that open and then sit idle from holding on to connection resources.

### Server-driven heartbeat

The server pings every tracked socket on an interval and terminates any that did
not answer the previous ping. The client also pings, but that only measures
latency and cannot detect a half-open connection, such as a phone that drops off
the network without closing cleanly. Reaping those zombie sockets frees the
roster slots and reconnection grace timers they would otherwise keep held.

### Tokens stay out of the URL

The host token travels in the `Sec-WebSocket-Protocol` handshake header rather
than the query string. A connection that puts `hostToken=` in the URL is
rejected and logged, which keeps tokens out of access logs and browser history.
The full token and authentication flow is its own topic.

## Why all of these

Each guard covers a different failure mode at the connection layer, before any
game message is processed: a hijacked cross-site socket, an oversized frame, a
socket that connects but never joins, and a socket that has quietly died.
Together with the per-message rate limit and the input validation, they give the
WebSocket channel layered defence rather than a single check.

## Where it's configured

The limits live in `src/config/game.config.ts`: `WS.MAX_PAYLOAD_BYTES` and
`WS.HEARTBEAT_INTERVAL_MS`, plus `ROOM.JOIN_TIMEOUT_MS` for the idle timeout. The
connection handling, covering the origin check, idle timer, heartbeat tracking
and token transport, is in `src/server/socket/socket.gateway.ts` inside
`handleConnection`. The origin allow-list logic sits in
`src/server/socket/utils/origin.util.ts`, and the allowed origins are injected
through the `WS_ALLOWED_ORIGINS` token. The heartbeat sweep is in
`src/server/socket/heartbeat-monitor.ts`.
