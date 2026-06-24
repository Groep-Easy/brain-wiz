FROM node:22-alpine AS builder

WORKDIR /app

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

RUN npm run build

RUN npm prune --omit=dev

USER node

CMD ["node", "dist/server/index.js"]
