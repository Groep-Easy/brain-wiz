#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " Starting Brain Wiz Development Environment"
echo "======================================"

# 1. Stop all project containers
echo "-> Stopping existing containers..."
docker compose down --timeout 10

# 2. Release occupied ports
echo "-> Checking for occupied ports (3000, 5173, 5432, 3100)..."
for port in 3000 5173 5432 3100; do
    if lsof -ti ":$port" >/dev/null 2>&1; then
        echo "   Freeing port $port..."
        sudo kill -9 $(lsof -ti ":$port") 2>/dev/null || true
    fi
done

# 3. Rebuild images & 4. Recreate containers
echo "-> Rebuilding and starting containers (Database & Observability)..."
docker compose up --build -d db loki promtail grafana

echo "-> Waiting for PostgreSQL to be ready..."
for i in {1..15}; do
    if docker compose exec db pg_isready -U postgres >/dev/null 2>&1; then
        echo "   Database is ready!"
        break
    fi
    sleep 2
    if [ "$i" -eq 15 ]; then
        echo "ERROR: PostgreSQL failed to start in time."
        exit 1
    fi
done

# 5. Run migrations
echo "-> Running database migrations..."
if [ ! -d "node_modules" ]; then
    npm install
fi
npm run build:server
node --env-file=.env ./node_modules/typeorm/cli.js migration:run -d dist/server/database/data-source.js

# 6. Run health checks
echo "-> Checking core services health..."
# Loki health check
if ! curl -s http://localhost:3100/ready | grep -q "ready"; then
    echo "WARNING: Loki is not ready yet."
fi

# 7. Start application server and Vite
echo "-> Starting local development servers..."
# Note: npm run dev runs concurrently for NestJS and Vite
npm run dev &
DEV_PID=$!

echo "======================================"
echo " Startup Summary"
echo "======================================"
echo " - Database: postgres://localhost:5432"
echo " - Grafana : http://localhost:3200"
echo " - Backend : http://localhost:3000"
echo " - Vite Dev: http://localhost:5173"
echo "======================================"
echo " Press Ctrl+C to stop servers."

wait $DEV_PID
