#!/bin/bash

set -euo pipefail

REPO_URL="https://github.com/Groep-Easy/brain-wiz.git"
REPO_DIR="$HOME/brain-wiz-dev"
BRANCH="develop"

echo "Targeting DEV environment tracking branch: $BRANCH"

if ! command -v git >/dev/null 2>&1; then
    echo "ERROR: Git is not installed."
    exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
    echo "ERROR: Docker is not installed."
    exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
    echo "ERROR: Docker Compose is not installed."
    exit 1
fi

if [ ! -d "$REPO_DIR/.git" ]; then
    echo "Repository not found, cloning..."
    git clone -b "$BRANCH" "$REPO_URL" "$REPO_DIR"
else
    echo "Updating repository..."
    git -C "$REPO_DIR" fetch origin
    git -C "$REPO_DIR" reset --hard "origin/$BRANCH"
fi

cd "$REPO_DIR"

echo "Patching docker-compose.yml to avoid dev/prod conflicts..."
sed -i 's/container_name: server/container_name: dev-server/g' docker-compose.yml
sed -i 's/container_name: postgres-db/container_name: dev-postgres-db/g' docker-compose.yml
sed -i 's/container_name: pgadmin/container_name: dev-pgadmin/g' docker-compose.yml
sed -i "s/'3000:3000'/'3001:3000'/g" docker-compose.yml
sed -i 's/"5432:5432"/"5433:5432"/g' docker-compose.yml
sed -i 's/"5050:80"/"5051:80"/g' docker-compose.yml

if [ ! -f ".env" ]; then
    echo "No .env found, copying .env.example..."
    cp .env.example .env
    # Patch .env to use port 5433 for DB_PORT because postgres is exposed on 5433 on the host...
    # Actually, in docker-compose, the app container connects to `db:5432` over the docker network, so DB_PORT in .env should remain 5432 for the container! 
    # But wait, DB_HOST=db and DB_PORT=5432 inside the container network. 
    # So we don't strictly need to change DB_PORT inside .env for the app to work. 
fi

if [ -f ".env.example" ] && [ -f ".env" ]; then
    echo "Checking environment variables..."

    MISSING=$(grep -v '^#' .env.example | cut -d= -f1 | while read -r VAR; do
        grep -q "^${VAR}=" .env || echo "$VAR"
    done)

    if [ -n "$MISSING" ]; then
        echo "ERROR: Missing environment variables:"
        echo "$MISSING"
        echo "Auto-populating missing variables from .env.example..."
        echo "$MISSING" | while read -r VAR; do
            grep "^${VAR}=" .env.example >> .env
        done
        echo "Variables appended to .env."
    fi
else
    echo "Error: no .env.example or .env found."
    exit 1
fi

echo "Stopping containers..."
sudo docker compose down

echo "Pulling Docker images..."
sudo docker compose pull

echo "Starting containers..."
sudo docker compose up -d

echo "Dev Deployment completed successfully!"
