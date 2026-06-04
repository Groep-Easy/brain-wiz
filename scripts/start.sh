#!/usr/bin/env bash
set -e

echo "🚀 Starting Brain Wiz Development Environment..."

# Ensure dependencies are installed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Start PostgreSQL database using docker-compose
echo "🐘 Starting PostgreSQL database..."
docker compose up -d db

# Wait for PostgreSQL to become available
echo "⏳ Waiting for PostgreSQL to accept connections..."
# Give it a few seconds to start up
sleep 3
# Simple retry loop checking pg_isready or just waiting
for i in {1..10}; do
  if docker compose exec -T db pg_isready -U postgres > /dev/null 2>&1; then
    echo "✅ Database is ready!"
    break
  fi
  echo "Waiting for database... ($i/10)"
  sleep 2
done

# Run TypeScript compilation
echo "🔨 Compiling TypeScript..."
npm run build

# Run TypeORM migrations
echo "🔄 Running database migrations..."
node --env-file=.env ./node_modules/typeorm/cli.js migration:run -d dist/server/database/data-source.js

# Start the dev server
echo "💻 Starting NestJS dev server..."
npm run dev
