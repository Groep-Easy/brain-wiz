#!/bin/bash

set -e

REPO_URL="https://github.com/Groep-Easy/brain-wiz.git"
REPO_DIR="brain-wiz"

echo "Controleer vereisten..."

if ! command -v git >/dev/null 2>&1; then
    echo "Fout: Git is niet geïnstalleerd."
    exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
    echo "Fout: Docker is niet geïnstalleerd."
    exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
    echo "Fout: Docker Compose is niet geïnstalleerd."
    exit 1
fi

if [ ! -d "$REPO_DIR/.git" ]; then
    echo "Repository niet gevonden. Clonen..."
    git clone "$REPO_URL" "$REPO_DIR"
else
    echo "Repository bestaat al."
fi

cd "$REPO_DIR"

echo "Repository updating..."
git pull


echo "Stop running containers"
sudo docker compose down

echo "Docker pulling images..."
sudo docker compose pull

echo "Update containers"
sudo docker compose up -d

echo "Deployed!"
