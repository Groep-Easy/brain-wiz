#!/bin/bash

set -euo pipefail

REPO_URL="https://github.com/Groep-Easy/brain-wiz.git"
REPO_DIR="brain-wiz"
SCRIPT_NAME="deploy-uva.sh"

RUNNING_SCRIPT="$(readlink -f "$0")"

echo "Running script: $RUNNING_SCRIPT"

echo "Checking requirements..."

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
    git clone "$REPO_URL" "$REPO_DIR"
else
    echo "Updating repository..."
    git -C "$REPO_DIR" fetch origin
    git -C "$REPO_DIR" reset --hard origin/$(git -C "$REPO_DIR" branch --show-current)
fi

REPO_SCRIPT_PATH="$REPO_DIR/$SCRIPT_NAME"

if [ ! -f "$REPO_SCRIPT_PATH" ]; then
    echo "ERROR: deploy script not found in repository!"
else
    RUNNING_HASH=$(sha256sum "$RUNNING_SCRIPT" | awk '{print $1}')
    REPO_HASH=$(sha256sum "$REPO_SCRIPT_PATH" | awk '{print $1}')

    echo "Running hash: $RUNNING_HASH"
    echo "Repo hash:    $REPO_HASH"

    if [ "$RUNNING_HASH" != "$REPO_HASH" ]; then
        echo ""
        echo "ERROR: $SCRIPT_NAME is not synchronized with Git!"
        echo "The running script differs from the repository version."
    fi
fi

cd "$REPO_DIR"

echo "Starting with deployment..."


if [ -f ".env.example" ] && [ -f ".env" ]; then
    echo "Checking environment variables..."

    MISSING=$(grep -v '^#' .env.example | cut -d= -f1 | while read -r VAR; do
        grep -q "^${VAR}=" .env || echo "$VAR"
    done)

    if [ -n "$MISSING" ]; then
        echo "ERROR: Missing environment variables:"
        echo "$MISSING"
        exit 1
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

echo "Deployment completed successfully!"
