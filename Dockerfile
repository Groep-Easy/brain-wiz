#syntax=docker/dockerfile:1
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
  npm ci

COPY . .

RUN npm run build

RUN npm prune --omit=dev

# ===== RUN STAGE =====
FROM gcr.io/distroless/nodejs22-debian13

WORKDIR /app

COPY --from=builder /app/dist/src ./dist/src
COPY --from=builder /app/dist/config ./dist/config
COPY --from=builder /app/dist/scripts ./dist/scripts
COPY --from=builder /app/node_modules ./node_modules

CMD ["dist/src/server/index.js"]
