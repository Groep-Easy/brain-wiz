# Architecture overview

## Three runtime contexts, one repo

```
src/server/   Node.js process on the host machine.
              Owns ALL game state. Single source of truth.
              Never trust client input — validate everything.

src/host/     React + TypeScript app (built with Vite). Served by the server.
              Displayed on the TV or main screen.
              Read-only: receives state, never mutates it.

src/client/   React + TypeScript app (built with Vite). Served by the server.
              Loaded in each player's phone browser.
              Sends player actions, receives state updates.

src/shared/   No runtime context of its own.
              Constants, JSDoc types, and small pure utilities.
              Imported by all three contexts above.
              A change here is a breaking change everywhere.
```

## Communication model

```
[Phone 1] ──┐
[Phone 2] ──┤── Socket.io (WebSocket, local network) ──── [Node server]
[Phone N] ──┘                                                    │
                                                         broadcasts to all
                                                         ┌───────┴──────┐
                                                      [Phones]     [Host display]
```

The server is the only actor that mutates state.
Clients send actions. Server validates, updates state, broadcasts to everyone.
Host display is a pure subscriber — it never sends events.

## Reconnection strategy

Because the server owns all state, reconnection is simple:
on reconnect, the server sends a full `ROOM_STATE_UPDATE` to the
rejoining socket. The client re-renders from scratch. No merge conflicts.

## Build steps

Both browser contexts are **React + TypeScript apps built with Vite**, each
with its own config and `tsconfig.json`:

| Context      | Vite config             | Dev script           | Build output  | Dev port |
| ------------ | ----------------------- | -------------------- | ------------- | -------- |
| `src/client` | `vite.client.config.ts` | `npm run client:dev` | `dist/client` | 5173     |
| `src/host`   | `vite.host.config.ts`   | `npm run host:dev`   | `dist/host`   | 5174     |

This replaces the earlier "no build step" plan — both UIs grew complex enough
to justify a component framework. The host remains a **read-only subscriber**
(it never sends events); only its build tooling changed, not its role.

The server remains CommonJS-free and is compiled with `tsc`.
