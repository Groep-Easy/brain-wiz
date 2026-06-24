import { Injectable } from '@nestjs/common'
import type { RoundType } from '@brain-wiz/shared/types/index'
import { BalanceScaleServerAdapter } from './balance-scale.server.js'
import { BonkAirServerAdapter } from './bonk-air.server.js'
import type { MinigameAdapter, ProceduralRoundType } from './minigame.types.js'
import { SlidingPuzzleServerAdapter } from './sliding-puzzle.server.js'
import { VaultRushServerAdapter } from './vault-rush.server.js'
import { WordleServerAdapter } from './wordle.server.js'
import { LightSwitchServerAdapter } from './light-switch.server.js'

@Injectable()
export class MinigameRegistry {
  private readonly adapters: ReadonlyMap<ProceduralRoundType, MinigameAdapter>

  public constructor(
    slidingPuzzle: SlidingPuzzleServerAdapter,
    balanceScale: BalanceScaleServerAdapter,
    vaultRush: VaultRushServerAdapter,
    wordle: WordleServerAdapter,
    lightSwitch: LightSwitchServerAdapter,
    bonkAir: BonkAirServerAdapter
  ) {
    const adapters = new Map<ProceduralRoundType, MinigameAdapter>()
    adapters.set(slidingPuzzle.type, slidingPuzzle)
    adapters.set(balanceScale.type, balanceScale)
    adapters.set(vaultRush.type, vaultRush)
    adapters.set(wordle.type, wordle)
    adapters.set(lightSwitch.type, lightSwitch)
    adapters.set(bonkAir.type, bonkAir)
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
