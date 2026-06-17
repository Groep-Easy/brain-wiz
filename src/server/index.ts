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

  app.use('/client', express.static(clientDist))
  app.use('/client/{*path}', (_req: express.Request, res: express.Response) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })

  app.use('/', express.static(hostDist))
  app.use('/{*path}', (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.method === 'GET' && !req.headers.upgrade) {
      return res.sendFile(path.join(hostDist, 'index.html'))
    }
    next()
  })

  setSwaggerConfig(app)
  await app.listen(config.PORT, '127.0.0.1')

  // eslint-disable-next-line no-console
  console.log('\n  Brain Wiz Server Successfully Started!')
  if (config.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.log(`
  Host Display:  http://localhost:5174/host
  Player Client: http://localhost:5173/client
  REST API:      http://localhost:3000/api
    `)
  } else {
    // eslint-disable-next-line no-console
    console.log(`
  Host Display:  ${config.BASE_URL}/host
  Player Client: ${config.BASE_URL}/client
  REST API:      ${config.BASE_URL}/api
    `)
  }
}

void bootstrap()
