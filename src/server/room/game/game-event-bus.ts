/**
 * @file game-event-bus.ts
 * @description In-process pub/sub for game domain events (rxjs Subject). Server
 * side only; nothing here is ever serialized to a socket. Zero new deps.
 */
import { Injectable } from '@nestjs/common'
import { Subject, type Observable } from 'rxjs'
import { filter } from 'rxjs/operators'
import type { GameDomainEvent } from './game-events'

@Injectable()
export class GameEventBus {
  private readonly subject = new Subject<GameDomainEvent>()

  public publish(event: GameDomainEvent): void {
    this.subject.next(event)
  }

  public on<T extends GameDomainEvent['type']>(
    type: T
  ): Observable<Extract<GameDomainEvent, { type: T }>> {
    return this.subject.pipe(
      filter((e): e is Extract<GameDomainEvent, { type: T }> => e.type === type)
    )
  }
}
