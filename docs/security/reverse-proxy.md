# Reverse Proxy Hardening

In production the app never faces the internet directly. An nginx reverse proxy
sits in front of it, terminates TLS, enforces a set of security headers, and
soaks up abusive traffic at the network edge before it ever reaches the
application. The app container only listens on the internal Docker network
(`expose: 3000`), so nginx is the single public entry point on ports 80 and 443.

This doc covers the security side of that proxy. The operational side, meaning
why we run nginx along with deployment, certificates and logging, lives in
`docs/architecture/nginx-proxy.md`.

## What we implemented

### TLS termination and HTTPS enforcement

All traffic is served over HTTPS, and plain HTTP is not an option. Port 80 does
nothing but `return 301` to the HTTPS URL, so a browser that hits it first is
bounced straight to TLS. Only modern protocols are allowed
(`ssl_protocols TLSv1.2 TLSv1.3`) with a modern ECDHE and CHACHA20 cipher list,
and TLS session tickets are turned off.

The certificate is currently self-signed, which is an accepted trade-off for the
VPN-gated host. The config is structured so that switching to a real CA
certificate, and re-enabling OCSP stapling that a self-signed cert cannot use,
is a path already laid out in the file.

### Security response headers

The HTTPS vhost adds a baseline set of headers to every response, all marked
`always` so they are sent on error responses too:

- `Strict-Transport-Security` (HSTS, 1 year) keeps browsers on HTTPS.
- `X-Content-Type-Options: nosniff` stops MIME-type sniffing.
- `X-Frame-Options: DENY` blocks clickjacking through iframes.
- `Referrer-Policy: strict-origin-when-cross-origin` trims referrer leakage.

A restrictive `Content-Security-Policy` and a `Permissions-Policy` are written
out in the config but left commented, ready to switch on once they are tuned to
exactly what the frontend loads. For now they are staged rather than enforced.

### Edge rate and connection limiting

On top of the application's own rate limiting (see `rate-limiting.md`), nginx
turns away abusive traffic before it reaches the app. A general zone allows 10
requests per second per IP with a burst of 20 across all routes, while a strict
zone allows only 2 requests per minute per IP with a burst of 5 on auth and
login paths to blunt brute-force attempts. A per-IP connection-count cap (20
globally, 10 on auth paths) guards against slow-loris and connection-flood
attacks. Clients that go over the limit get a correct `429 Too Many Requests`
instead of nginx's default `503`.

### Request size and timeout limits

Every timeout is set explicitly rather than left on nginx's defaults, covering
`client_body_timeout`, `client_header_timeout`, `send_timeout` and the proxy
timeouts. That closes the door on slow-request attacks that try to tie up
workers. Request bodies are capped at 1 MB and header buffers are bounded. The
one deliberate exception is the WebSocket location, which raises
`proxy_read_timeout` so that long-lived game connections stay open.

### Information-leak prevention

The proxy avoids handing attackers free reconnaissance. `server_tokens off`
keeps the nginx version out of headers and error pages, the upstream
fingerprinting headers (`X-Powered-By`, `X-AspNet-Version`,
`X-AspNetMvc-Version`) are stripped with `proxy_hide_header`, and custom error
pages replace nginx's default branded ones.

### Forwarded-header integrity

When proxying to the app, the forwarding headers are set rather than appended,
so `X-Real-IP` and `X-Forwarded-For` are pinned to `$remote_addr`. This prevents
a client from spoofing the `X-Forwarded-For` chain to forge its source IP, which
matters because the app trusts the proxy (`TRUST_PROXY`) and uses the client IP
for its own per-IP throttling. Each request also gets an `X-Request-ID` that is
propagated to the app, so nginx and application logs can be correlated for an
audit trail.

## Why at the edge

These controls live at the proxy because they are cheapest and safest to enforce
before traffic reaches application code. A flood, an oversized body or a
slow-loris connection is dropped at nginx and never costs the Node process a
thing. Together with the app-level rate limiting, input validation and WebSocket
hardening, the edge becomes the outermost layer of a defence-in-depth setup
rather than the only line of defence.

## Where it's configured

Everything above lives in `nginx/nginx.conf`, including the TLS block, the
`limit_req` and `limit_conn` zones, the security `add_header` lines, the
timeouts, and the `location` proxy blocks. The public ports (80 and 443) and the
app being internal-only (`expose: 3000`) are set in `docker-compose.yml`, and
the app side of the trust relationship is the `TRUST_PROXY` flag handled in
`src/server/index.ts`.
