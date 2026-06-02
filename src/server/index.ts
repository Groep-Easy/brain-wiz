/**
 * @file index.ts
 * @owner server-squad
 * @description Server entry point. Bootstraps the NestJS application with a
 * native `ws` WebSocket adapter. Keep this file thin — it wires things
 * together, nothing else.
 */
import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { WsAdapter } from '@nestjs/platform-ws'
import { AppModule } from './app.module.js'
import { config } from '../../config/server.js'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)

  // Use the native `ws` transport for WebSocket gateways.
  app.useWebSocketAdapter(new WsAdapter(app))

  // TODO: serve the static host display (src/host) and phone client (src/client).
  // Old Express mounts were `app.use('/host', express.static('src/host'))` and
  // `app.use('/', express.static('src/client'))`. Replace with ServeStaticModule
  // (@nestjs/serve-static) or equivalent once the static assets are wired up.

  await app.listen(config.PORT, '0.0.0.0')

  // eslint-disable-next-line no-console
  console.log(`Brain Wis running on http://0.0.0.0:${config.PORT}`)
  // eslint-disable-next-line no-console
  console.log(`Host display: http://localhost:${config.PORT}/host`)
}

void bootstrap()
