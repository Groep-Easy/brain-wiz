/**
 * @file src/server/flow/flow.module.ts
 * @description Game-flow feature module. Serves the building-block catalog and
 * provides FlowService (catalog/randomize/validate) to the lobby orchestrator.
 */
import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/index'
import { FlowService } from './flow.service'
import { FlowController } from './flow.controller'

@Module({
  imports: [DatabaseModule],
  controllers: [FlowController],
  providers: [FlowService],
  exports: [FlowService],
})
export class FlowModule {}
