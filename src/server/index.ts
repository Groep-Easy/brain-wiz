/**
 * @file index.ts
 * @owner server-squad
 * @description Server entry point. Bootstraps the NestJS application with a
 * native `ws` WebSocket adapter. Keep this file thin — it wires things
 * together, nothing else.
 */
import 'reflect-metadata'
import * as path from 'path'
import * as express from 'express'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { WsAdapter } from '@nestjs/platform-ws'
import { AppModule } from './app.module'
import { config } from '../config/server'
import { setSwaggerConfig } from '../config/swagger-doc'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)

  // Allow the host display and phone client (served from their own Vite dev
  // origins) to call the HTTP API cross-origin, e.g. POST /rooms.
  app.enableCors({
    origin: [...config.CORS_ORIGINS],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  })

  // Use the native `ws` transport for WebSocket gateways.
  app.useWebSocketAdapter(new WsAdapter(app))

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))

  // ---------------------------------------------------------------------------
  // Static frontends — served from the Vite build output.
  // /       → Welcome page (links to both apps)
  // /host   → Host display Vite app  (dist/host)
  // /client → Player phone Vite app  (dist/client)
  //
  // Vite base paths (/host, /client) must match these mounts so built asset
  // URLs are correct. See vite.host.config.ts and vite.client.config.ts.
  //
  // /host must be mounted BEFORE /client to prevent the catch-all from
  // swallowing /host/* sub-paths.
  // ---------------------------------------------------------------------------
  const distDir = path.join(__dirname, '..') // __dirname = dist/server → .. = dist/

  const hostDist = path.join(distDir, 'host')
  const clientDist = path.join(distDir, 'client')

  // Welcome page at /
  app.use('/', (_req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (_req.path !== '/') {
      next()
      return
    }
    res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Brain Wiz</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0 }
    body {
      min-height: 100dvh;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 2rem;
      background: #0f0f14;
      font-family: system-ui, sans-serif;
      color: #fff;
    }
    h1 { font-size: 2.5rem; letter-spacing: -0.03em }
    p  { color: #888; font-size: 0.95rem }
    .links { display: flex; gap: 1.25rem; flex-wrap: wrap; justify-content: center }
    a {
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 0.85rem 2rem; border-radius: 0.75rem; font-size: 1.1rem;
      font-weight: 600; text-decoration: none; transition: opacity 0.15s;
    }
    a:hover { opacity: 0.85 }
    .host   { background: #7c3aed; color: #fff }
    .client { background: #0ea5e9; color: #fff }
  </style>
</head>
<body>
  <h1>🧠 Brain Wiz</h1>
  <p>Choose your role to get started</p>
  <div class="links">
    <a class="host"   href="/host">📺 Game Host</a>
    <a class="client" href="/client">📱 Player</a>
  </div>
</body>
</html>`)
  })

  // Host display: /host and /host/* (SPA fallback)
  // Express v5 uses path-to-regexp v8+ which requires named wildcard params.
  app.use('/host', express.static(hostDist))
  app.use('/host/{*path}', (_req: express.Request, res: express.Response) => {
    res.sendFile(path.join(hostDist, 'index.html'))
  })

  // Player client: /client and /client/* (SPA fallback)
  app.use('/client', express.static(clientDist))
  app.use('/client/{*path}', (_req: express.Request, res: express.Response) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
  setSwaggerConfig(app)

  // eslint-disable-next-line no-console
  console.log(`REST API endpoints: ${config.BASE_URL}/api`)
}

void bootstrap()
