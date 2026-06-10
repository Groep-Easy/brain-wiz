# Infrastructure & Nginx Proxy

In production (e.g. the UvA Server), Brain Wiz is deployed using Docker Compose and is fronted by an **Nginx Reverse Proxy**. 

## Why Nginx?

The application relies on Nginx to securely manage traffic before it ever touches the internal Node.js backend. This provides several critical layers of functionality:

### 1. SSL/HTTPS & Zero-Touch Certificates
Nginx automatically handles SSL termination. The `deploy.sh` script generates a secure 2048-bit RSA self-signed wildcard certificate on boot. This ensures that both standard HTTP traffic and the game's WebSocket connections (`wss://`) are fully encrypted.

### 2. Port Management & Isolation
Nginx binds to port `3000` on the host machine and safely proxies traffic to the internal Node.js Docker container. The Node backend itself runs on an isolated Docker network and is **never** directly exposed to the internet. This reduces the attack surface.

### 3. Security & Rate Limiting
Nginx acts as a security buffer:
- **Rate Limiting**: It enforces request rate limits to prevent spam and DDoS attacks.
- **Error Pages**: It strips identifying server headers and serves minimal, custom HTML error pages (for 40x and 50x errors) located in `./nginx/errors/`. This prevents infrastructure leakage (i.e. attackers won't see raw Express or NestJS error traces if the backend drops).

### 4. Frontend Compatibility (Vite)
Nginx applies specific `Content-Security-Policy` and `Permissions-Policy` headers. These are tuned to allow Vite's HMR (Hot Module Replacement) and inline scripts to run smoothly during development and staging, while remaining restrictive enough to block malicious injections.

## Deployment Details

When `./deploy.sh prod` is executed:
1. It validates that `openssl` is installed.
2. It auto-generates certificates into `./nginx/ssl/`.
3. Docker Compose boots the `nginx` container mapping `3000:3000`.
4. The Nginx config (`./nginx/nginx.conf`) explicitly routes WebSocket upgrade requests to the `brain-wiz` container.

> [!NOTE]
> Because the certificates are self-signed, browsers will throw a privacy warning on the first visit. Users must click "Advanced -> Proceed" to bypass it. In a fully public production scenario, these certificates should be replaced by valid Let's Encrypt certificates.
