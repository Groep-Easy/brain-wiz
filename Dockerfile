#syntax=docker/dockerfile:1
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
  npm ci

COPY . .

# Build all three targets:
#   1. NestJS server       → dist/server/
#   2. Vite player client  → dist/client/
#   3. Vite host display   → dist/host/
RUN npm run build:server && \
    npm run client:build && \
    npm run host:build

RUN npm prune --omit=dev

CMD ["node", "dist/server/index.js"]
