import { Injectable } from '@nestjs/common'
import type { RoundType } from '@brain-wiz/shared/types/index'
import { BalanceScaleServerAdapter } from './balance-scale.server.js'
import type { MinigameAdapter, ProceduralRoundType } from './minigame.types.js'
import { SlidingPuzzleServerAdapter } from './sliding-puzzle.server.js'
import { VaultRushServerAdapter } from '@brain-wiz/server/room/game/minigames/vault-rush.server'

@Injectable()
export class MinigameRegistry {
  private readonly adapters: ReadonlyMap<ProceduralRoundType, MinigameAdapter>

  public constructor(
    slidingPuzzle: SlidingPuzzleServerAdapter,
    balanceScale: BalanceScaleServerAdapter,
    vaultRush: VaultRushServerAdapter
  ) {
    const adapters = new Map<ProceduralRoundType, MinigameAdapter>()
    adapters.set(slidingPuzzle.type, slidingPuzzle)
    adapters.set(balanceScale.type, balanceScale)
    adapters.set(vaultRush.type, vaultRush)
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
