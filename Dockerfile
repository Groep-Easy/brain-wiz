#syntax=docker/dockerfile:1
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root + every workspace manifest so `npm ci` can resolve the full tree.
COPY package*.json ./
COPY src/shared/package.json ./src/shared/
COPY src/config/package.json ./src/config/
COPY src/minigames/package.json ./src/minigames/
COPY src/client/package.json ./src/client/
COPY src/host/package.json ./src/host/
COPY src/server/package.json ./src/server/

RUN --mount=type=cache,target=/root/.npm \
  npm ci

COPY . .

# Build all targets (libs first, then server, then the two Vite apps):
#   npm run build = build:libs && build:server && client:build && host:build
RUN npm run build

RUN npm prune --omit=dev

CMD ["node", "dist/server/index.js"]
