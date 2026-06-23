# Security Audit Report — Brain-Wis

**Date:** 2026-06-23
**Scope:** Full repository (`brain-wis`) — NestJS/TypeScript monorepo (server, client, host, minigames, shared, config) plus deployment infrastructure (Docker, nginx, Loki/Grafana, CI).
**Method:** Static review of source, configuration, dependencies, and infrastructure. No dynamic/penetration testing performed. Findings were manually verified against the source before inclusion.

> **Note on severities:** Ratings reflect impact in a *production* context. This is a student/casual game project; several "production" findings are acceptable for local development but would matter if the app is exposed publicly (a real server IP — `83.96.203.127` — appears in the repo, so public exposure is plausible).

---

## Executive Summary

The application has a **solid security foundation**: a global `ValidationPipe` with `whitelist`/`forbidNonWhitelisted`, class-validator DTOs, parameterized DB queries (no SQL injection found), cryptographically secure host/reconnect tokens (`randomUUID`), timing-safe token comparison, WebSocket origin checks, per-IP host-auth throttling, rate limiting, payload caps, and config-time production guards (blocks `synchronize`/`drop schema` in prod). React's auto-escaping protects the frontends from classic XSS.

The main gaps are in **infrastructure hardening and secrets hygiene**, plus a couple of code-level weaknesses. No remotely exploitable critical code vulnerability was confirmed.

### Findings by severity

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High     | 4 |
| Medium   | 6 |
| Low      | 6 |
| Informational / Positive | — |

---

## High

### H-1 — Container runs as root (no `USER` in Dockerfile)
> ✅ **FIXED** (branch `security/secrets-and-docker-hardening`, 2026-06-23) — added `USER node` before `CMD` in the `Dockerfile`.

**File:** `Dockerfile` (no `USER` directive; ends at `CMD ["node", "dist/server/index.js"]`)
The image runs as `root` (uid 0). A code-execution or container-escape bug would have host-root implications. Add a non-root user:
```dockerfile
RUN addgroup -g 1001 nodejs && adduser -S -u 1001 -G nodejs nodejs
USER nodejs
```

### H-2 — Weak/default admin credentials with insecure fallbacks
> ✅ **FIXED (Grafana)** (branch `security/secrets-and-docker-hardening`, 2026-06-23) — `docker-compose.yml` now uses `${GRAFANA_ADMIN_USER:?}` / `${GRAFANA_ADMIN_PASSWORD:?}` (fails closed, no more silent `admin:admin`); `.env.example` ships a `CHANGE_ME...` placeholder. **Note:** Compose interpolates globally, so all deploys (incl. core `make deploy`) now require these vars to be set in the environment's `.env`. Remaining: rotate the reused `ADMIN_API_KEY`/DB secrets to strong unique values per environment.

**Files:** `docker-compose.yml` (Grafana), `.env.test`, `.env.example`, `.env` (local, untracked)
- Grafana defaults to `admin:admin` when env vars are unset:
  `GF_SECURITY_ADMIN_USER: ${GRAFANA_ADMIN_USER:-admin}` / `GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD:-admin}`.
- Reused weak secrets across the repo: `brainwiz`, `dev-secret-key`, `ci_test_password`, and (local, untracked `.env`) `supersecret` / `localdevsecret`.
- `ADMIN_API_KEY` guards the question-creation REST endpoint; if it ships as one of these defaults it is trivially guessable.

**Fix:** Remove insecure `:-admin` fallbacks (fail closed instead), require strong unique secrets at boot, and never reuse the same value across services.

### H-3 — Tracked test env file leaks a real server IP and weak credentials
> ✅ **FIXED** (branch `security/secrets-and-docker-hardening`, 2026-06-23) — removed the real IP `83.96.203.127` from `CORS_ORIGINS` and removed the duplicate `ADMIN_API_KEY` line in `.env.test`. **Note:** the IP still exists in prior git history; purge it from history (e.g. `git filter-repo`) if it must be fully removed.

**File:** `.env.test` (this file **is** committed; `.env` is correctly gitignored and *not* tracked)
- `CORS_ORIGINS` contains a real public IP: `https://83.96.203.127` — discloses production/deployment infrastructure.
- Contains `PGADMIN_DEFAULT_PASSWORD=brainwiz`, `GRAFANA_ADMIN_PASSWORD=brainwiz`, `ci_test_password`, and a duplicate `ADMIN_API_KEY` definition (lines 6 and 9 — `dev-secret-key` then `brainwiz`; last wins, which is confusing and error-prone).

**Fix:** Remove the real IP from version control, deduplicate `ADMIN_API_KEY`, and treat even "test" credentials as non-reusable placeholders.

### H-4 — pgAdmin exposed as root with authentication disabled
> ✅ **FIXED** (branch `security/secrets-and-docker-hardening`, 2026-06-23) — dropped `user: root`, bound the port to `127.0.0.1:5050:80` (loopback only; reach via SSH tunnel), and enabled authentication in the env templates: `PGADMIN_CONFIG_SERVER_MODE="True"`, `LOGIN_DISABLED="False"`, `MASTER_PASSWORD_REQUIRED="True"`, with a `CHANGE_ME` strong-password placeholder. **Operator action:** set a strong `PGADMIN_DEFAULT_PASSWORD` in the server's `.env`.

**Files:** `docker-compose.yml` (`pgadmin` service: `user: root`, `ports: "5050:80"`), `.env.example`/`.env.test` (`PGADMIN_CONFIG_LOGIN_DISABLED="True"`, `PGADMIN_CONFIG_MASTER_PASSWORD_REQUIRED="False"`)
pgAdmin runs as root, is published to the host on `5050`, and is configured to disable login and master-password prompts. Anyone reaching port 5050 gets unauthenticated, root-level database administration. It is behind a `tools` profile (not started by default), which limits exposure, but the configuration is dangerous if ever enabled outside an isolated machine.

**Fix:** Never enable `LOGIN_DISABLED` outside a fully isolated dev box; drop `user: root`; bind the port to `127.0.0.1` only; keep it out of any reachable environment.

---

## Medium

### M-1 — Room codes use `Math.random()` with a small keyspace
**File:** `src/shared/utils/room-code.ts:18` — `ALPHABET[Math.floor(Math.random() * ALPHABET.length)]`; `ROOM_CODE_LENGTH = 4` (`src/shared/constants/game-limits.ts:7`), 32-char alphabet → ~32⁴ ≈ **1.05M** combinations.
`Math.random()` is not cryptographically secure, and a 4-char code is a small space. The public, unauthenticated `GET /rooms/:code` endpoint (see M-2) makes enumeration of active rooms feasible (joining/spectating others' games). Player-join is not protected by the host-auth throttle.

**Fix:** Use `crypto.randomBytes`/`crypto.getRandomValues` and consider a longer code:
```ts
import { randomBytes } from 'node:crypto'
const b = randomBytes(ROOM_CODE_LENGTH)
return Array.from(b, (x) => ALPHABET[x % ALPHABET.length]).join('')
```

### M-2 — Unauthenticated room-state disclosure / enumeration
**File:** `src/server/room/lobby/room.controller.ts:59` — `GET /rooms/:code` returns room state with no auth/guard.
Combined with M-1, an attacker can enumerate codes and read room state. (State-changing flow/start endpoints *do* require a `hostToken`, which is good.) Add rate limiting and/or restrict full state to the host token if spectating is not an intended feature.

### M-3 — No application-level rate limiting on REST endpoints
> ✅ **FIXED** (branch `security/secrets-and-docker-hardening`, 2026-06-23) — added `@nestjs/throttler` (v6.5.0). `ThrottlerModule.forRoot` + a global `APP_GUARD` `ThrottlerGuard` in `app.module.ts` enforce a per-IP default of 100 req/60s on every REST route; `POST /rooms` and `POST /questions` get a stricter 10/60s via `@Throttle`; `GET /health` is `@SkipThrottle`-exempt. Real client IP is honored via the existing Express `trust proxy` (TRUST_PROXY) behind nginx. Limits live in `HTTP_THROTTLE` (`src/config/game.config.ts`). Verified at runtime: requests past the limit return **429**, skipped routes never throttle.

**File:** `src/server/index.ts` (no `@nestjs/throttler`)
Room creation (`POST /rooms`) and query endpoints have no app-layer throttling. nginx defines rate-limit zones in production (good), but the app is unprotected if hit directly (e.g. dev port 3000, or any path nginx doesn't cover). Add `@nestjs/throttler` for defense-in-depth.

### M-4 — Self-signed TLS certificate
> ✅ **ACCEPTED — keep self-signed for now** (assessed 2026-06-23). A Let's Encrypt setup (via sslip.io) was prototyped but reverted: the UvA-hosted server is firewalled at the network level. Confirmed empirically — external probes from ~16 countries timed out on **both port 80 and 443** (`ufw allow 80` only opens the host firewall; the UvA upstream firewall, which we don't control, blocks inbound). So ACME HTTP-01 can't reach it, and there's no owned domain for DNS-01 — no public CA cert is possible while the box stays inbound-blocked. **Decision:** keep the self-signed cert; it's acceptable because access is already network-restricted, which bounds MITM exposure (residual risk **Low**). **Future option:** the only way to get trusted HTTPS without inbound is **Cloudflare Tunnel** (outbound-only `cloudflared`), but that makes the app publicly reachable (no longer VPN-only) — revisit if public play is wanted. `mkcert` (local CA) remains an option for a known device set.

**File:** `nginx/nginx.conf` (`ssl_certificate .../nginx-selfsigned.crt`, `ssl_stapling off`), documented in `README.md` ("Advanced → Proceed").
Self-signed certs train users to click through browser warnings and provide no identity assurance (MITM risk). Use a CA-issued certificate (e.g. Let's Encrypt/certbot) for any real deployment.

### M-5 — PostgreSQL published to the host in dev override
> ✅ **FIXED** (branch `security/secrets-and-docker-hardening`, 2026-06-23) — bound to `127.0.0.1:${DB_PORT:-5432}:5432` in `docker-compose.override.yml`.

**File:** `docker-compose.override.yml` — `db.ports: "${DB_PORT:-5432}:5432"`
Publishes Postgres on the host (default 0.0.0.0:5432). On a machine without a firewall this exposes the DB (with the weak passwords from H-2) to the local network. Bind to `127.0.0.1:5432:5432` for local-only access.

### M-6 — Grafana provisioned datasource is editable; Loki has no auth
**Files:** `loki/grafana-provisioning/datasources/loki.yml` (`editable: true`), `loki/promtail-config.yml` (pushes to `http://loki:3100/...` with no auth)
Authenticated Grafana users can repoint the datasource (data exfiltration/SSRF-style abuse). Loki has no `auth_enabled` and would be unauthenticated if its port were ever exposed. Set `editable: false` and keep Loki internal-only.

---

## Low

### L-1 — Non-constant-time API key comparison
**File:** `src/server/utils/api-key.guard.ts:12` — `apiKey !== expectedKey`.
Theoretical timing side-channel. Low risk in practice, but prefer `crypto.timingSafeEqual` for consistency with the codebase's own `safeEqual` used for tokens.

### L-2 — Avatar `bodyColor` accepted without format validation
**File:** `src/server/socket/dto/socket.dto.ts:11-13` — `bodyColor` is `@IsString()` only (no length/format).
A WebSocket client can bypass the client-side color presets and submit an arbitrary string, broadcast to all players. **XSS is not achievable** via the current sinks — React auto-escapes the SVG `fill={color}` attribute (`src/shared/components/CharacterPreview.tsx`) and the `style={{ backgroundColor }}` object (`src/client/components/JoinScreen.tsx`); neither allows attribute/script breakout. Impact is limited to UI weirdness / unvalidated data. Still, add input hygiene:
```ts
@Matches(/^#[0-9a-fA-F]{6}$/) public bodyColor!: string
```
Also bound `faceId` (`@Min(0) @Max(FACE_COUNT-1)`).

### L-3 — Dependency vulnerabilities (`npm audit`: 9 — 8 high, 1 moderate)
The high entries are almost all the NestJS dependency chain (`@nestjs/core`, `platform-express`/`multer`, `websockets`, `swagger`, `typeorm`, `testing`); `npm audit`'s "fix" suggests semver-major *downgrades*, indicating version-resolution noise rather than confirmed reachable exploits. One genuinely actionable item: **`js-yaml` ≤4.1.1 — quadratic-complexity DoS (GHSA-h67p-54hq-rp68, moderate)**, pulled via `@nestjs/swagger`. Review and bump where a clean upgrade exists; treat the NestJS chain warnings as lower priority but track them.

### L-4 — No HTTPS enforcement at the application layer
**File:** `src/server/index.ts`
Redirect is handled by nginx in production (good), but the app does not enforce HTTPS itself and `TRUST_PROXY` must be set correctly behind the proxy. Acceptable given the nginx setup; documented here for completeness.

### L-5 — Unpinned / loosely-pinned container base images
**File:** `docker-compose.yml` — `nginx:alpine` (no version), `postgres:16` (major only), `dpage/pgadmin4` (no tag).
Non-reproducible builds; a future base-image change could silently introduce regressions. Pin to specific minor versions or digests.

### L-6 — `DB_SYNCHRONIZE=true` / `DB_DROP_SCHEMA` in dev/test env files
**Files:** `.env.test:25`, local `.env`
Dangerous if a dev/test config is ever pointed at real data. **Mitigated:** `src/config/database.config.ts` throws at startup if these are enabled with `NODE_ENV=production`. Keep that guard; never run these against production data.

---

## Positive Findings (verified strengths)

- **No SQL injection found** — TypeORM used with parameter binding throughout (`room.service.ts` raw `query(...)` uses `$1,$2`; `question.service.ts`/`flow.service.ts` use QueryBuilder bindings).
- **Strong input validation** — global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` (`src/server/index.ts:29`); class-validator DTOs across REST and WebSocket handlers (`@UsePipes(ValidationPipe)` on the gateway).
- **Cryptographically secure tokens** — host & reconnect tokens via `randomUUID()`; client IDs via DB `@PrimaryGeneratedColumn('uuid')`.
- **Timing-safe comparison** — `safeEqual()` (`connection-registry.ts`) for host/reconnect tokens.
- **WebSocket hardening** — origin validation (anti-CSWSH), token rejected in query string (enforced via `Sec-WebSocket-Protocol`), 16 KB payload cap, idle/join timeouts, heartbeat reaping, per-connection rate limiting.
- **Brute-force protection** — per-IP sliding-window host-auth throttle (5 failures / 60s lockout).
- **Production config guards** — startup rejects `DB_SYNCHRONIZE`/`DB_DROP_SCHEMA` in production; warns on prod query logging; enforces min password length.
- **Anti-cheat answer validation** — registration/window/option/duplicate checks plus a DB unique constraint on `(clientId, roundId)`.
- **CORS** is whitelist-based from env; **nginx** sets HSTS/X-Content-Type-Options/X-Frame-Options/Referrer-Policy and hides upstream headers.
- **CI hygiene** — workflows use `permissions: contents: read`; no `pull_request_target`.
- **`.dockerignore`/`.gitignore`** correctly exclude `.env`, `node_modules`, build output; `.env` is **not** git-tracked.

---

## Prioritized Remediation

> **Remediation in progress** — branch `security/secrets-and-docker-hardening` (2026-06-23). Items marked ✅/⚠️ above have been (partly) addressed.

1. ✅ **H-1** Add a non-root `USER` to the Dockerfile.
2. ⚠️ **H-2 / H-3** Removed real IP + `:-admin` fallbacks; Grafana fails closed. Remaining: rotate reused `ADMIN_API_KEY`/DB secrets to strong unique values; consider purging the IP from git history.
3. ✅ **H-4** pgAdmin: dropped root, bound to loopback, and enabled login (server mode + master password).
4. ☐ **M-1 / M-2** Switch room codes to CSPRNG (+longer code); rate-limit / restrict `GET /rooms/:code`.
5. ✅ **M-3** `@nestjs/throttler` added — global 100/60s per IP + strict 10/60s on create endpoints, health exempt.
6. ✅ **M-4** Accepted: keep self-signed. Public-CA cert not feasible (UvA firewall blocks inbound — confirmed; no domain). Residual risk Low. Future trusted-HTTPS path = Cloudflare Tunnel (makes app public) or mkcert (known devices).
7. ⚠️ **M-5 / M-6** ✅ Postgres bound to localhost. Remaining: set Grafana datasource `editable: false`.
8. ☐ **Low items** as cleanup: hex-validate `bodyColor`, timing-safe API key compare, bump `js-yaml`, pin image versions.

---

*Generated by an automated static review. Verify each item in context before remediating; static analysis can produce false positives and cannot confirm exploitability without dynamic testing.*
