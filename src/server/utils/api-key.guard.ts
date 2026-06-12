import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common'
import type { Request } from 'express'
import { server_config } from '../../config/server'

@Injectable()
export class ApiKeyGuard implements CanActivate {
  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>()
    const apiKey = request.headers['x-api-key']
    const expectedKey = server_config.ADMIN_API_KEY

    if (!apiKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid or missing API key')
    }

    return true
  }
}
