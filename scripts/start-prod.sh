#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " Starting Brain Wiz Production Services"
echo "======================================"

if [[ "${NODE_ENV:-production}" != "production" ]]; then
    echo "WARNING: NODE_ENV is not set to 'production'."
fi

DOCKER_CMD="docker compose -f docker-compose.prod.yml"
if ! docker ps >/dev/null 2>&1; then
    if sudo -n docker ps >/dev/null 2>&1; then
        DOCKER_CMD="sudo docker compose -f docker-compose.prod.yml"
    else
        echo "ERROR: Docker requires sudo privileges."
        exit 1
    fi
fi

# Store current running container hashes for rollback detection
PREV_HASHES=$($DOCKER_CMD ps -q)

echo "-> Bringing up services without forced rebuilding..."
# Use --no-build for production safety, rely on pulled images
$DOCKER_CMD up --no-build -d

echo "-> Running health checks..."
# Wait for PostgreSQL
for i in {1..10}; do
    if $DOCKER_CMD exec db pg_isready -U postgres >/dev/null 2>&1; then
        echo "   Database is healthy."
        break
    fi
    sleep 2
    if [ "$i" -eq 10 ]; then
        echo "ERROR: PostgreSQL failed health check."
        # Rollback detection - if failure, notify operator
        echo "-> FAILURE REPORTING: Production deployment stalled due to DB health check failure."
        exit 1
    fi
done

# Wait for Nginx proxy to respond with 200/404 (just verify it's up)
echo "   Checking Nginx proxy..."
if ! curl -sk https://localhost >/dev/null; then
    echo "WARNING: Nginx proxy failed to respond securely to localhost."
fi

# Summary
echo "======================================"
echo " Production Services Started"
echo "======================================"
$DOCKER_CMD ps
