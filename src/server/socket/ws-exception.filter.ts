/**
 * @file ws-exception.filter.ts
 * @owner server-squad
 * @description Catches exceptions thrown while handling WebSocket messages —
 * most importantly the BadRequestException raised by the gateway's
 * ValidationPipe when an inbound payload fails class-validator checks. Instead
 * of the error being swallowed (the default with the native `ws` adapter), it
 * sends a structured VALIDATION_ERROR frame back to the offending client so the
 * front-end can react. Unexpected (non-validation) errors are logged.
 */
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common'
import { WsException } from '@nestjs/websockets'
import { WebSocket } from 'ws'
import * as EVENTS from '@brain-wiz/shared/constants/socket-events.constants'

interface WsErrorPayload {
  message: string
  details?: string[]
}

@Catch()
export class WsExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(WsExceptionsFilter.name)

  public catch(exception: unknown, host: ArgumentsHost): void {
    const client = host.switchToWs().getClient<WebSocket>()
    const payload = this.describe(exception)

    if (client && client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify({ event: EVENTS.VALIDATION_ERROR, data: payload }))
      } catch {
        // Client went away mid-send — nothing more we can do.
      }
    }

    if (!(exception instanceof HttpException) && !(exception instanceof WsException)) {
      this.logger.error('Unhandled WebSocket error', exception as Error)
    }
  }

  private describe(exception: unknown): WsErrorPayload {
    if (exception instanceof HttpException) {
      const response = exception.getResponse()
      if (typeof response === 'object' && response !== null && 'message' in response) {
        const raw = (response as { message: string | string[] }).message
        const details = Array.isArray(raw) ? raw : [raw]
        return { message: 'Invalid message payload', details }
      }
      return { message: exception.message }
    }
    if (exception instanceof WsException) {
      const error = exception.getError()
      return { message: typeof error === 'string' ? error : 'WebSocket error' }
    }
    return { message: 'Internal server error' }
  }
}
