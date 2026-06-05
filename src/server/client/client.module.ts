/**
 * @file client.module.ts
 * @description Client feature module. Owns persistence-facing operations for
 * the Client entity and exports ClientService for the lobby orchestrator.
 */
import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/index'
import { ClientService } from './client.service'

@Module({
  imports: [DatabaseModule],
  providers: [ClientService],
  exports: [ClientService],
})
export class ClientModule {}
