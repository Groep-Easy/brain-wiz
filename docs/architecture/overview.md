# Architecture Overview

Brain Wiz is a multiplayer quiz game. A host display (a TV or laptop) shows the
game to the room, and players join from their phones with a room code. A single
Node.js server owns all game state and talks to every device.

```
[Phone 1] ──┐
[Phone 2] ──┤── WebSocket ── [Node server] ── WebSocket ── [Host display]
[Phone N] ──┘                     │ TypeORM
                                  ▼
                            [PostgreSQL]
```

## The decision that shapes everything: the server is authoritative

Phones and the host display are thin views. They render whatever state the server
pushes and send user intent back; no game logic, scoring, or timing runs in the
browser. That keeps the game tamper-resistant (a player cannot edit their own
score) and gives the rules exactly one home.

## Runtime contexts

| Context | Location     | Role                                                     |
| ------- | ------------ | -------------------------------------------------------- |
| Server  | `src/server` | Authoritative state, persistence, realtime orchestration |
| Host    | `src/host`   | Read-only display on the shared screen                   |
| Client  | `src/client` | The phone UI players use to join and answer              |
| Shared  | `src/shared` | Event names, types, and pure utilities all three import  |

The three contexts agree on one event-and-type vocabulary in `src/shared`, so a
change to a payload is caught by the type checker in every context at once.

## The pieces, documented per decision

- [WebSocket layer](websockets.md): why live gameplay runs over native `ws`.
- [HTTP API](http-api.md): why content management is a separate REST channel.
- [Database](database.md): why PostgreSQL and TypeORM, managed by migrations.
- [Nginx proxy](nginx-proxy.md): the production edge (TLS, isolation, logging).

Security decisions live in [`docs/security`](../security/).
