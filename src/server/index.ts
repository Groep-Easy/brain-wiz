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
  await app.listen(config.PORT, '0.0.0.0')
  // eslint-disable-next-line no-console
  console.log(`REST API endpoints: ${config.BASE_URL}/api`)
}

void bootstrap()
