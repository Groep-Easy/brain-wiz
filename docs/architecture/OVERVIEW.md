# Architecture overview

## Three runtime contexts, one repo

```
src/server/   Node.js process on the host machine.
              Owns ALL game state. Single source of truth.
              Never trust client input — validate everything.

src/host/     Static HTML/CSS/JS. Served by the server.
              Displayed on the TV or main screen.
              Read-only: receives state, never mutates it.

src/client/   Static HTML/CSS/JS. Served by the server.
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

`src/host/` keeps the original "no build step" approach: plain ES modules
served directly as static files, no transpiler. This removes a category of
tooling failure for the read-only host display.

`src/client/` is a **React + TypeScript app built with Vite** (see
`vite.config.ts` and `src/client/tsconfig.json`). Dev runs through the Vite
dev server (`npm run client:dev`); production builds emit to `dist/client`
(`npm run client:build`). This replaces the earlier static-file plan for the
client — the phone UI grew complex enough to justify a component framework.

The server remains CommonJS-free and is compiled with `tsc`.
