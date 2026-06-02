/**
 * @file config/server.js
 * @owner git-master
 * @description Runtime server configuration.
 * Read from environment variables with safe defaults.
 * Never commit .env — copy .env.example and fill in values.
 */
export const config = Object.freeze({
  PORT: Number(process.env.PORT ?? 3000),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
})
