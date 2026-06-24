/**
 * Type contracts for the Bonk Air minigame engine. Shared by the server adapter
 * (scoring), the React component (render + input), and the unit tests.
 */

/** Integer grid coordinate (column, row). */
export interface Cell {
  x: number
  y: number
}

/** Pixel-space point, optionally carrying a heading angle. */
export interface Vec {
  x: number
  y: number
}

export type Mission = 'land' | 'depart' | 'transit'

/** Public puzzle definition shipped to clients (world is recomputed from this). */
export interface BonkAirPuzzle {
  /** Engine string seed (hashed to a numeric RNG seed). */
  seed: string
  /** Difficulty: 1 = Trainee, 2 = Certified, 3 = Rush hour. */
  diff: number
}

export interface PlaneType {
  key: string
  label: string
  pre: string
  /** Blocks per second. */
  speed: number
  /** Visual radius in px. */
  r: number
}

export interface Runway {
  cells: Cell[]
  dir: Cell
  thr: Cell
  end: Cell
  appr: Cell
  long: boolean
  label: string
}

export interface Gate {
  c: Cell
  edge: number
  label: string
}

export interface Target {
  kind: 'runway' | 'gate'
  idx: number
}

export interface Plane {
  id: number
  type: PlaneType
  mission: Mission
  callsign: string
  spawn: Cell
  edge: number
  target: Target
  rwIdx: number
  color: string
  sym: string
  /** Auto-routed reference path (set during generation). */
  bfs: Cell[]
}

export interface Cloud {
  c: Cell
  r: number
  cells: Cell[]
}

export interface Military {
  x0: number
  y0: number
  w: number
  h: number
}

export interface Star {
  c: Cell
}

export interface Island {
  x: number
  y: number
  r: number
  seed: number
}

export interface World {
  seed: number
  diff: number
  blocked: Uint8Array
  runways: Runway[]
  gates: Gate[]
  planes: Plane[]
  clouds: Cloud[]
  military: Military | null
  stars: Star[]
  islands: Island[]
  hasAirport: boolean
}

/** A single aircraft's drawn route. */
export interface PlanePath {
  cells: Cell[]
  complete: boolean
}

/** A full plan: one route per plane id. */
export type BonkAirSolution = Record<number, PlanePath>

/** The player's wire submission. */
export interface BonkAirSubmission {
  solution: BonkAirSolution
}

export interface BonkAirScoreConfig {
  /** Round answering window in ms (used for the quick-planning bonus). */
  timeLimitMs: number
  /** Cap on quick-planning bonus points. */
  earlyMax: number
}

export interface PlaneResult {
  id: number
  callsign: string
  label: string
  color: string
  sym: string
  state: string
  mission: Mission
  base: number
  stars: number
}

export interface SimResults {
  per: PlaneResult[]
  perfect: number
  violations: number
  penalty: number
  score: number
}

/** Server-authoritative scoring output. */
export interface BonkAirScoreResult {
  /** Total points awarded (sim score + quick-planning bonus). */
  score: number
  earlyBonus: number
  results: SimResults
  /** True when every plane had a completed route. */
  allComplete: boolean
}

export type SimEventType = 'done' | 'lost' | 'bonk' | 'sep' | 'star'

export interface SimEvent {
  type: SimEventType
  t: number
  p?: SimPlane
  a?: SimPlane
  b?: SimPlane | null
  x?: number
  y?: number
  kind?: 'runway' | 'gate'
  mission?: Mission
  zone?: boolean
  /** True when the crash was a no-fly-zone interception (vs a weather/collision bonk). */
  intercept?: boolean
  heli?: boolean
  si?: number
}

/** A plane as tracked inside a running simulation. */
export interface SimPlane {
  ref: Plane
  id: number
  type: PlaneType
  color: string
  sym: string
  state: string
  x: number
  y: number
  ang: number
  stars: number
  trail: Vec[]
  pts: Vec[]
  cums: number[]
  total: number
  drawn: number
  landS: number
  liftS: number
  complete: boolean
  s: number
}
