import { Injectable } from '@nestjs/common'
import type { RoundType } from '../../../../shared/types/index.js'
import { BalanceScaleServerAdapter } from './balance-scale.server.js'
import type { MinigameAdapter, ProceduralRoundType } from './minigame.types.js'
import { SlidingPuzzleServerAdapter } from './sliding-puzzle.server.js'

@Injectable()
export class MinigameRegistry {
  private readonly adapters: ReadonlyMap<ProceduralRoundType, MinigameAdapter>

  public constructor(
    slidingPuzzle: SlidingPuzzleServerAdapter,
    balanceScale: BalanceScaleServerAdapter
  ) {
    const adapters = new Map<ProceduralRoundType, MinigameAdapter>()
    adapters.set(slidingPuzzle.type, slidingPuzzle)
    adapters.set(balanceScale.type, balanceScale)
    this.adapters = adapters
  }

  public isProcedural(type: RoundType): type is ProceduralRoundType {
    return this.get(type) !== undefined
  }

  public get(type: RoundType): MinigameAdapter | undefined {
    for (const adapter of this.adapters.values()) {
      if (adapter.accepts(type)) {
        return adapter
      }
    }
    return undefined
  }
}
