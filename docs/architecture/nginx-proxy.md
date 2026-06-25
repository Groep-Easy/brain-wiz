# Infrastructure & Nginx Proxy

In production (e.g. the UvA Server), Brain Wiz is deployed using Docker Compose and is fronted by an **Nginx Reverse Proxy**.

## Why Nginx?

The application relies on Nginx to securely manage traffic before it ever touches the internal Node.js backend. This provides several critical layers of functionality:

### 1. SSL/HTTPS & Zero-Touch Certificates

Nginx automatically handles SSL termination. Run `make cert` once on a fresh host to generate a 2048-bit RSA self-signed certificate into `nginx/ssl/` (nginx will not start without it). This ensures that both standard HTTP traffic and the game's WebSocket connections (`wss://`) are fully encrypted.

### 2. Port Management & Isolation

Nginx is the only public entry point, bound to ports `80` and `443` on the host. It proxies traffic to the Node.js backend, which listens on port `3000` inside an isolated Docker network and is **never** directly exposed to the internet.

### 3. Security & Rate Limiting

Nginx acts as a security buffer:

- **Rate Limiting**: Enforces request rate limits to prevent spam and DDoS attacks. This is the edge layer; the app adds HTTP and WebSocket limits on top (see [Rate Limiting](../security/rate-limiting.md)).
- **Error Pages**: Strips identifying server headers and serves custom HTML error pages located in `./nginx/errors/`.

### 4. Structured JSON Logging

Nginx writes access logs in structured JSON format (not the default `combined` text format):

- Fields (`status`, `method`, `remote_addr`, `request_time`, `request_id`, …) are first-class values, with no regex parsing required.
- Promtail promotes `status`, `method`, and `remote_addr` as indexed Loki labels for cheap filtering.
- Query directly in Grafana: `{job="nginx"} | json | status = "429"`

Logs are written to `/var/log/nginx/access.log` via the shared Docker volume `nginx_logs`.

### 5. Request ID Tracing

Every request gets a unique `$request_id`, which is:

- Returned to the client as `X-Request-ID` (users/support can quote it in bug reports).
- Forwarded upstream as `X-Request-ID` so app logs can emit the same value.
- Included in the JSON access log under `request_id`.

Correlate across both nginx and app logs in Loki:

```
{job="nginx"} | json | request_id = "abc123"
```

---

## Deployment

All services (app, nginx, database, and optionally observability) live in a **single `docker-compose.yml`**. Core services start by default; extras are opt-in via Compose profiles.

### One-time setup (fresh host)

```bash
ssh <user>@<server-ip>
git clone https://github.com/Groep-Easy/brain-wiz.git ~/brain-wiz && cd ~/brain-wiz
cp .env.example .env        # set NODE_ENV=production, secrets, and
                            # CORS_ORIGINS=https://<server-ip-or-domain>
make cert                   # generate the self-signed TLS cert (once)
```

### Deploy / redeploy

```bash
make deploy                 # pull + build + start core (app, nginx, db) on 80/443
make deploy-obs             # same, plus observability (Grafana on 3200)
make down                   # stop the stack
```

`make deploy` runs `docker compose -f docker-compose.yml up --build -d`. The
explicit `-f` skips the local-dev `docker-compose.override.yml`, so the
database is **never** published to the host on the server. The DB and Loki are
internal-only (no host ports); nginx is the sole public entry point on 80/443.

### Accessing from home over VPN

The UvA server is only reachable while connected to the **UvA VPN** (Cisco AnyConnect / eduVPN). Once connected:

| Service                           | URL                       |
| --------------------------------- | ------------------------- |
| App                               | `https://<server-ip>`     |
| Grafana (`observability` profile) | `http://<server-ip>:3200` |
| pgAdmin (`tools` profile)         | `http://<server-ip>:5050` |

> [!NOTE]
> Browsers will show a privacy warning for `https://` because the certificate is self-signed. Click **Advanced → Proceed** to continue. Replace with a Let's Encrypt cert for a fully public deployment.

> [!IMPORTANT]
> Make sure the server's firewall allows the ports above from the VPN subnet. On the UvA server run `sudo ufw allow <port>` for any port not yet open.

---

## Observability: Loki + Promtail + Grafana

All three observability services are included in `docker-compose.yml` alongside the app, gated behind the `observability` profile. Start them with `make deploy-obs` (or `docker compose --profile observability up -d`).

### How logs flow

```
nginx (writes JSON)
  └─► nginx_logs volume (Docker named volume)
         └─► Promtail (reads + parses JSON, ships to Loki)
                └─► Loki (stores + indexes by label)
                       └─► Grafana (query, dashboards, alerts)
```

### Recommended Grafana alerts

| Alert                                      | Why                                            |
| ------------------------------------------ | ---------------------------------------------- |
| Rate of `429`s spiking                     | Rate limiting is working, but you want to know |
| Single IP hitting 50+ unique paths in 60 s | Scanner / bot behaviour                        |
| Repeated `401`s from same `remote_addr`    | Credential stuffing                            |
| Upstream p99 response time degrading       | Something is wrong upstream                    |

### Files

| File                                             | Purpose                                                                                         |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `docker-compose.yml`                             | All services: app, nginx, db (core), pgadmin (`tools`), Loki/Promtail/Grafana (`observability`) |
| `docker-compose.override.yml`                    | Local-dev only: publishes the DB port (never used by `make deploy`)                             |
| `Makefile`                                       | `make cert` / `make deploy` / `make deploy-obs` / `make down`                                   |
| `loki/promtail-config.yml`                       | Promtail scrape config (tails nginx access + error logs)                                        |
| `loki/grafana-provisioning/datasources/loki.yml` | Auto-provisions Loki as Grafana default datasource                                              |
