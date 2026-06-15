#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " Starting Brain Wiz Development Environment"
echo "======================================"

# 1. Stop all project containers
echo "-> Stopping existing containers..."
docker compose -f docker-compose.dev.yml down -v --remove-orphans --timeout 10

# 2. Release occupied ports
echo "-> Checking for occupied ports (3000, 5173, 5432, 3100)..."
for port in 3000 5173 5432 3100; do
    if lsof -ti ":$port" >/dev/null 2>&1; then
        echo "   Freeing port $port..."
        sudo kill -9 $(lsof -ti ":$port") 2>/dev/null || true
    fi
done

# 3. Rebuild images & 4. Recreate containers
echo "-> Rebuilding and starting containers (Database)..."
docker compose -f docker-compose.dev.yml up --remove-orphans --build -d db

echo "-> Waiting for PostgreSQL to be ready..."
for i in {1..15}; do
    if docker compose -f docker-compose.dev.yml exec db pg_isready -U postgres >/dev/null 2>&1; then
        echo "   Database is ready!"
        break
    fi
    sleep 2
    if [ "$i" -eq 15 ]; then
        echo "ERROR: PostgreSQL failed to start in time."
        exit 1
    fi
done

# 5. Skip migrations
echo "-> Skipping TypeORM migrations (local dev relies on DB_SYNCHRONIZE=true)..."

# 6. Run health checks
echo "-> Checking core services health..."
# Loki health check removed since we don't start Loki for local dev

# 7. Start application server
echo "-> Starting local development server..."
# Note: npm run dev runs the NestJS backend
npm run dev &
DEV_PID=$!

echo "======================================"
echo " Startup Summary"
echo "======================================"
echo " - Database: postgres://localhost:5432"
echo " - Backend : http://localhost:3000"
echo "======================================"
echo " Press Ctrl+C to stop servers."

wait $DEV_PID
