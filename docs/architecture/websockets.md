# WebSocket Layer

Everything that happens during a live game runs over WebSockets. This note records
why, and the choices made around it.

## The decision

Live gameplay uses the native [`ws`](https://github.com/websockets/ws) library,
wired into NestJS through `WsAdapter`. The host and every phone hold one
persistent connection, so the server can push state (`ROUND_START`,
`LEADERBOARD_SHOW`, `TIMER_TICK`, …) and receive intent (`PLAYER_JOIN`,
`ANSWER_SUBMIT`, …) without polling.

## Why WebSocket and not HTTP

A quiz is server-driven: timers tick, rounds reveal, and the leaderboard updates
for everyone at the same moment. Those are server-initiated events. Over plain
HTTP the clients would have to poll for them, which is slower and far chattier. A
persistent socket lets the server push the instant something changes.

## Why native `ws` and not socket.io

We do not need socket.io's transport fallbacks or its room/namespace layer; the
server already owns rooms and state. Native `ws` is smaller, speaks standard
`wss://`, and leaves us in control of the message envelope. NestJS's `WsAdapter`
lets it slot into the same module and dependency-injection system as the rest of
the server.

## The shared contract

Event names and payload shapes live in `src/shared` (`events/socket-events.ts`
and `types/`), imported by server, host, and client alike. Event strings are never
hardcoded, so a rename or a payload change becomes a type error in every context
rather than a silent runtime failure.

## Server-authoritative

Clients send intent, never results. Scoring, timing, and correctness are computed
on the server only, so a player cannot edit their own score in the browser and
there is one source of truth for the game rules.

## Hardening

The connection edge enforces origin allow-listing, host-token throttling, idle
timeouts, inbound rate limiting, a payload-size cap, and a heartbeat that reaps
dead sockets, all before any game logic runs. See
[WebSocket hardening](../security/websocket-hardening.md).

## Where it lives

`src/server/socket` (gateway and guards), the adapter in `src/server/index.ts`,
and the event contract in `src/shared/events`. The full event catalogue is the
[WebSocket protocol](../other/socket-protocol.md) reference.
