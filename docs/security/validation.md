# Input Validation

Every piece of data a client sends is validated before any game logic runs, so
the rest of the server can assume it is working with well-formed input. We use
NestJS's built-in validation, [`class-validator`](https://github.com/typestack/class-validator)
together with `class-transformer`, on both the HTTP API and the WebSocket
messages.

## What we implemented

### How it works

Each incoming payload is described by a DTO class whose fields carry validation
rules as decorators, such as `@IsString`, `@IsInt`, `@Min`, `@Max` and
`@Matches`. A `ValidationPipe` then checks the payload against those rules. It
strips any properties we didn't declare (the `whitelist` option) and rejects the
request outright if it contains unknown fields (the `forbidNonWhitelisted`
option). Anything that doesn't match the DTO is rejected before the handler runs.

### HTTP API

The `ValidationPipe` is registered globally, so it applies to every REST
endpoint. Request bodies, for example when creating a question, are validated
against their DTOs, and an invalid request gets an HTTP `400 Bad Request`.

### WebSocket

The same validation runs on WebSocket messages. The gateway applies the
`ValidationPipe` to every message handler, and each message type has its own DTO
(join, answer submit, round submit, and so on). For example, a join must carry a
valid room code and player name, and an avatar's colour has to be a real hex
colour (`#rrggbb`) with its face id inside the allowed range.

WebSocket errors aren't returned automatically the way HTTP responses are, so we
added a small exception filter. When a message fails validation, it sends the
client a structured `VALIDATION_ERROR` message instead of silently dropping it.

## Why both

The HTTP and WebSocket channels accept different payloads and are validated
independently, so a malformed message is caught no matter which channel it
arrives on. Together with the server being authoritative over all game state,
this keeps clients from injecting unexpected or malicious data.

## Where it's configured

- DTOs and their rules live next to the code that uses them, under
  `src/server/**/dto` (for example `src/server/socket/dto/socket.dto.ts`).
- Shared limits such as room-code length, player-name bounds and avatar rules
  live in `src/shared/constants/game-limits.ts`, so the client and server agree
  on them.
- The WebSocket error filter is `src/server/socket/ws-exception.filter.ts`.
