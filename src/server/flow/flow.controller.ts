/**
 * @file src/server/flow/flow.controller.ts
 * @owner server-squad
 * @description Public read endpoint for the game-flow building blocks. Hosts use
 * this to populate the flow editor palette. Writes (storing/randomizing a flow)
 * are room-scoped and live on RoomsController so they can verify the host token.
 */
import { Controller, Get } from '@nestjs/common'
import { FlowService } from './flow.service'
import type { GameBlockDto } from '@shared/types/flow'

@Controller('flow')
export class FlowController {
  public constructor(private readonly flow: FlowService) {}

  /** The building-block catalog: themes that have questions + minigames. */
  @Get('blocks')
  public async getBlocks(): Promise<GameBlockDto[]> {
    return this.flow.getCatalog()
  }
}
