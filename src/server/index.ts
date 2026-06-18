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
import { ENV } from '@brain-wiz/config/env.config'
import { setSwaggerConfig } from '@brain-wiz/config/swagger-doc'
import { NodeEnv } from '@brain-wiz/shared/types/env'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)

  app.enableCors({
    origin: [...ENV.CORS_ORIGINS],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  })

  app.useWebSocketAdapter(new WsAdapter(app))

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))

  if (ENV.TRUST_PROXY) {
    app.getHttpAdapter().getInstance().set('trust proxy', 1)
  }

  const distDir = path.join(__dirname, '..')
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

  await app.listen(ENV.SERVER_PORT, ENV.SERVER_HOST)

  // eslint-disable-next-line no-console
  console.log('\n  Brain Wiz Server Successfully Started!')
  if (ENV.NODE_ENV === NodeEnv.Development) {
    // eslint-disable-next-line no-console
    console.log(`
  Host Display:  http://localhost:5174/host
  Player Client: http://localhost:5173/client
  REST API:      http://localhost:3000/api
    `)
  } else {
    // eslint-disable-next-line no-console
    console.log(`
  Host Display:  ${ENV.SERVER_BASE_URL}/host
  Player Client: ${ENV.SERVER_BASE_URL}/client
  REST API:      ${ENV.SERVER_BASE_URL}/api
    `)
  }
}

void bootstrap()
