/**
 * @file config/server.ts
 * @owner git-master
 * @description Runtime server configuration.
 * Read from environment variables with safe defaults.
 * Never commit .env — copy .env.example and fill in values.
 */
const DEFAULT_PORT = 3000

export const config = Object.freeze({
  PORT: Number(process.env['PORT'] ?? DEFAULT_PORT),
  NODE_ENV: process.env['NODE_ENV'] ?? 'development',
})
