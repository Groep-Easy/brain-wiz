# Infrastructure & Nginx Proxy

In production (e.g. the UvA Server), Brain Wiz is deployed using Docker Compose and is fronted by an **Nginx Reverse Proxy**.

## Why Nginx?

The application relies on Nginx to securely manage traffic before it ever touches the internal Node.js backend. This provides several critical layers of functionality:

### 1. SSL/HTTPS & Zero-Touch Certificates

Nginx automatically handles SSL termination. The `deploy.sh` script generates a secure 2048-bit RSA self-signed wildcard certificate on boot. This ensures that both standard HTTP traffic and the game's WebSocket connections (`wss://`) are fully encrypted.

### 2. Port Management & Isolation

Nginx binds to port `3000` on the host machine and safely proxies traffic to the internal Node.js Docker container. The Node backend itself runs on an isolated Docker network and is **never** directly exposed to the internet.

### 3. Security & Rate Limiting

Nginx acts as a security buffer:

- **Rate Limiting**: Enforces request rate limits to prevent spam and DDoS attacks.
- **Error Pages**: Strips identifying server headers and serves custom HTML error pages located in `./nginx/errors/`.

### 4. Structured JSON Logging

Nginx writes access logs in structured JSON format (not the default `combined` text format):

- Fields (`status`, `method`, `remote_addr`, `request_time`, `request_id`, …) are first-class values — no regex parsing required.
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

The `deploy.sh` script handles cloning/updating the repo, cert generation, port management, and Docker orchestration. All services — app, database, and observability — live in a **single `docker-compose.yml`**.

### Deploy modes

```bash
./deploy.sh prod              # master → ~/brain-wiz          (ports 80, 443, 5432, 5050, 3100, 3200)
./deploy.sh dev               # develop → ~/brain-wiz-dev     (ports 3000, 3080, 5433, 5051, 3201)
./deploy.sh branch <name>     # <name>  → ~/brain-wiz-branch  (ports 3000, 3080, 5433, 5051, 3201)
```

#### Deploying your current branch to the server (testing)

Push your branch, then SSH in and run:

```bash
ssh <user>@<server-ip>
cd ~
curl -O https://raw.githubusercontent.com/Groep-Easy/brain-wiz/master/deploy.sh
chmod +x deploy.sh
./deploy.sh branch your-feature-branch
```

The branch deploy uses alternate ports so it never conflicts with a running prod instance.

### Accessing from home over VPN

The UvA server is only reachable while connected to the **UvA VPN** (Cisco AnyConnect / eduVPN). Once connected:

| Service          | URL                        |
| ---------------- | -------------------------- |
| App (prod)       | `https://<server-ip>`      |
| Grafana (prod)   | `http://<server-ip>:3200`  |
| App (branch)     | `https://<server-ip>:3000` |
| Grafana (branch) | `http://<server-ip>:3201`  |
| pgAdmin (branch) | `http://<server-ip>:5051`  |

> [!NOTE]
> Browsers will show a privacy warning for `https://` because the certificate is self-signed. Click **Advanced → Proceed** to continue. Replace with a Let's Encrypt cert for a fully public deployment.

> [!IMPORTANT]
> Make sure the server's firewall allows the ports listed above from the VPN subnet. On the UvA server run `sudo ufw allow <port>` for any port not yet open.

---

## Observability: Loki + Promtail + Grafana

All three observability services are included in `docker-compose.yml` alongside the app — no separate file needed.

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

| File                                                                                                                                                | Purpose                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| [`docker-compose.yml`](file:///Users/anton/Documents/Projects/brain-wiz/docker-compose.yml)                                                         | All services: app, nginx, db, pgadmin, Loki, Promtail, Grafana |
| [`loki/promtail-config.yml`](file:///Users/anton/Documents/Projects/brain-wiz/loki/promtail-config.yml)                                             | Promtail scrape config (tails nginx access + error logs)       |
| [`loki/grafana-provisioning/datasources/loki.yml`](file:///Users/anton/Documents/Projects/brain-wiz/loki/grafana-provisioning/datasources/loki.yml) | Auto-provisions Loki as Grafana default datasource             |
| [`deploy.sh`](file:///Users/anton/Documents/Projects/brain-wiz/deploy.sh)                                                                           | Deployment script (`prod` / `dev` / `branch <name>`)           |
