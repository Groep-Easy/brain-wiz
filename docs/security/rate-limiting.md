# Rate Limiting

To protect the game against spam, abuse, and denial-of-service, we limit how
often a client can hit the server. We implemented this on both the **HTTP API**
and the **WebSocket** connection, since the two carry different kinds of traffic.

## What we implemented

### HTTP API

We use NestJS's built-in [`@nestjs/throttler`](https://docs.nestjs.com/security/rate-limiting)
module, registered globally so it covers every REST endpoint:

- **100 requests per minute per IP** as the general limit.
- **10 requests per minute per IP** on the sensitive endpoints that create data
  (`POST /rooms`, `POST /questions`), since those are the most attractive to abuse.
- The health-check endpoint is exempt so monitoring can poll it freely.

Clients that exceed a limit get an HTTP `429 Too Many Requests` response.

### WebSocket

All gameplay runs over a WebSocket connection, so we added a separate
per-connection limit there:

- **20 messages per second per connection.**
- Messages above that are dropped, which stops a single client from flooding the
  server while keeping normal play unaffected.

## Why two mechanisms

The HTTP limit and the WebSocket limit guard different entry points and work
independently — a client is limited on whichever channel it uses. We also run
behind an nginx reverse proxy in production, which adds a third limit at the
network edge before traffic even reaches the application.

## Where it's configured

All limits are kept in one place, `src/config/game.config.ts`
(`HTTP_THROTTLE` for the API and `RATE_LIMIT` for the WebSocket), so they are
easy to find and tune.
