export interface Light {
  id: number
  isOn: boolean
}

export interface LightSwitch {
  id: number
  affectedLights: number[]
}

export interface LightSwitchPuzzle {
  id: string
  lights: Light[]
  switches: LightSwitch[]
}

export interface LightSwitchGenerationInput {
  id: string
  seed?: string
}

export interface LightSwitchScoreConfig {
  pointsPerCorrectLight: number
  solveBonus: number
  timeLimitMs: number
}

export interface LightSwitchScoreBreakdown {
  lightsOff: number
  totalLights: number
  solved: boolean
  positionPoints: number
  speedBonus: number
  pointsAwarded: number
}
