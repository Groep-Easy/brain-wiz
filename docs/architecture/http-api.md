# HTTP API

Not everything is part of the realtime game loop. Content management and a few
lifecycle actions are a small REST API that sits alongside the WebSocket channel.

## The decision

Two channels, split by job:

- **WebSocket** carries live gameplay, both push and intent. See
  [WebSocket layer](websockets.md).
- **HTTP REST** carries everything outside the hot loop: managing questions and
  the game flow, creating rooms, join-code and QR generation, and health checks.

## Why a separate REST channel

Content management is ordinary CRUD: create a question, list questions, build a
flow. Request/response HTTP fits that exactly and brings mature tooling with it
(status codes, DTO validation, rate limiting). Keeping it off the socket also
keeps the gameplay path lean, carrying only gameplay messages.

## Why a static admin key (for now)

The write endpoints are an operator tool, not a public user feature, so they are
guarded by a single static `ADMIN_API_KEY` rather than a full login system. The
key is required in production and falls back to a dev value otherwise. It is a
deliberate trade-off: enough to gate content changes without building the user
accounts the game does not otherwise need.

## Guards

Every HTTP payload is validated against a DTO (`class-validator`, with unknown
fields rejected), the API is rate-limited (`@nestjs/throttler`), and cross-origin
access is restricted to a configured allow-list. See
[Input validation](../security/validation.md) and
[Rate limiting](../security/rate-limiting.md).

## Where it lives

The controllers under `src/server` (`question`, `flow`, `room` / `lobby`, and
`health`). Endpoints and auth detail are in the [REST API](../other/rest-api.md)
reference.
