#syntax=docker/dockerfile:1
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
  npm ci

COPY . .

RUN npm run build:server

RUN npm prune --omit=dev

CMD ["node", "dist/server/index.js"]
