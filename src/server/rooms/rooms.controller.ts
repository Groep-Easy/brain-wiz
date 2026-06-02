/**
 * @file rooms.controller.ts
 * @owner server-squad
 * @description HTTP routes for room lifecycle. Scaffold only — handler bodies
 * are intentionally NOT implemented yet (TODOs only).
 */
import { Controller, Get, Param, Post } from '@nestjs/common'

@Controller('rooms')
export class RoomsController {
  @Post()
  public createRoom(): void {
    // TODO: implement in week 1 — create a room via RoomManager and return its code
  }

  @Get(':code')
  public getRoom(@Param('code') code: string): void {
    // TODO: implement in week 1 — return the current RoomState for `code`
    void code
  }
}
