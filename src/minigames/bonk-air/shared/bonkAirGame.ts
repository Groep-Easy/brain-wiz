/**
 * Pure Bonk Air ("Sector Control") engine: seeded world generation, the
 * deterministic fixed-step simulation, and scoring. Ported from the standalone
 * prototype's `/*__PURE_START__*\/ … /*__PURE_END__*\/` block. Dependency-free on
 * purpose so the server scorer, the React component, and the tests all share one
 * source of truth. Determinism relies on this module's own `Rng` (mulberry32) —
 * do not swap it for another PRNG or the generated worlds will change.
 */
import { CONFIG, TAU } from './bonkAirGame.constants.js'
import type {
  BonkAirPuzzle,
  BonkAirScoreConfig,
  BonkAirScoreResult,
  BonkAirSolution,
  Cell,
  Island,
  Plane,
  PlanePath,
  PlaneResult,
  PlaneType,
  Runway,
  SimEvent,
  SimPlane,
  SimResults,
  Target,
  Vec,
  World,
} from './bonkAirGame.types.js'

export type {
  BonkAirPuzzle,
  BonkAirScoreConfig,
  BonkAirScoreResult,
  BonkAirSolution,
  BonkAirSubmission,
  Cell,
  Plane,
  PlanePath,
  Vec,
  World,
} from './bonkAirGame.types.js'
export { CONFIG, TAU } from './bonkAirGame.constants.js'

const FNV_OFFSET = 2166136261
const FNV_PRIME = 16777619
const MS_PER_SECOND = 1000

/**
 * Assert an indexed / optional access is present. Every index in this engine is
 * guaranteed valid by construction (bounds-checked generation, fixed-size
 * arrays); this keeps that invariant explicit without non-null assertions and
 * throws only if an impossible out-of-bounds access ever occurs.
 */
function req<T>(value: T | undefined): T {
  if (value === undefined) throw new RangeError('Bonk Air: unexpected out-of-bounds access')
  return value
}

/* ---------------- RNG ---------------- */
export function mulberry32(a: number): () => number {
  return function (): number {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class Rng {
  public readonly f: () => number
  public constructor(seed: number) {
    this.f = mulberry32(seed >>> 0)
  }
  public range(a: number, b: number): number {
    return a + (b - a) * this.f()
  }
  public int(a: number, b: number): number {
    return Math.floor(this.range(a, b + 1))
  }
  public pick<T>(arr: T[]): T {
    return req(arr[Math.floor(this.f() * arr.length)])
  }
  public chance(p: number): boolean {
    return this.f() < p
  }
  public shuffle<T>(arr: T[]): T[] {
    const a = arr.slice()
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.f() * (i + 1))
      ;[a[i], a[j]] = [req(a[j]), req(a[i])]
    }
    return a
  }
}

/* ---------------- geometry ---------------- */
export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y)
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v))

export function segInt(p: Vec, p2: Vec, p3: Vec, p4: Vec): boolean {
  const d = (a: Vec, b: Vec, c: Vec): number =>
    (c.x - a.x) * (b.y - a.y) - (b.x - a.x) * (c.y - a.y)
  const d1 = d(p3, p4, p),
    d2 = d(p3, p4, p2),
    d3 = d(p, p2, p3),
    d4 = d(p, p2, p4)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}

export function cumLens(pts: Vec[]): number[] {
  const c = [0]
  for (let i = 1; i < pts.length; i++) c.push(req(c[i - 1]) + dist(req(pts[i - 1]), req(pts[i])))
  return c
}

interface PointAlong {
  x: number
  y: number
  ang: number
}

export function pointAlong(pts: Vec[], cums: number[], s: number): PointAlong {
  const total = req(cums[cums.length - 1])
  if (s <= 0)
    return {
      x: req(pts[0]).x,
      y: req(pts[0]).y,
      ang: Math.atan2(req(pts[1]).y - req(pts[0]).y, req(pts[1]).x - req(pts[0]).x),
    }
  if (s >= total) {
    const a = req(pts[pts.length - 2]),
      b = req(pts[pts.length - 1])
    return { x: b.x, y: b.y, ang: Math.atan2(b.y - a.y, b.x - a.x) }
  }
  let lo = 0,
    hi = cums.length - 1
  while (lo < hi) {
    const m = (lo + hi) >> 1
    if (req(cums[m]) < s) lo = m + 1
    else hi = m
  }
  const i = lo,
    a = req(pts[i - 1]),
    b = req(pts[i]),
    t = (s - req(cums[i - 1])) / Math.max(1e-6, req(cums[i]) - req(cums[i - 1]))
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), ang: Math.atan2(b.y - a.y, b.x - a.x) }
}

/* ---------------- grid helpers ---------------- */
export const cellC = (c: Cell): Vec => ({
  x: CONFIG.X0 + (c.x + 0.5) * CONFIG.CELL,
  y: CONFIG.Y0 + (c.y + 0.5) * CONFIG.CELL,
})
export const pxCell = (p: Vec): Cell => ({
  x: Math.floor((p.x - CONFIG.X0) / CONFIG.CELL),
  y: Math.floor((p.y - CONFIG.Y0) / CONFIG.CELL),
})
export const inGrid = (c: Cell): boolean =>
  c.x >= 0 && c.y >= 0 && c.x < CONFIG.COLS && c.y < CONFIG.ROWS
export const sameCell = (a: Cell, b: Cell): boolean => a.x === b.x && a.y === b.y
export const adjacent = (a: Cell, b: Cell): boolean =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) === 1

export function lineCells(a: Cell, b: Cell): Cell[] {
  const out: Cell[] = [{ x: a.x, y: a.y }]
  let x = a.x,
    y = a.y,
    guard = 0
  while ((x !== b.x || y !== b.y) && guard++ < 200) {
    x += Math.sign(b.x - x)
    y += Math.sign(b.y - y)
    out.push({ x, y })
  }
  return out
}

/* ---------------- plane catalogue ---------------- */
export const PLANE_TYPES: Record<string, PlaneType> = {
  cessna: { key: 'cessna', label: 'Cessna 172', pre: 'PIP', speed: 1.3, r: 11 },
  b737: { key: 'b737', label: 'Boeing 737', pre: 'BOE', speed: 2.0, r: 16 },
  a380: { key: 'a380', label: 'Airbus A380', pre: 'JMB', speed: 1.6, r: 21 },
  jet: { key: 'jet', label: 'Bizjet', pre: 'DSH', speed: 2.7, r: 12 },
}
/** Plane types available in a generated world. Restricted to one type for now. */
export const ENABLED_PLANE_KEYS = ['cessna']
export const MISSION_COLORS = ['#FF6B5E', '#5AB1F0', '#7DE08A']
export const MISSION_SYMS = ['●', '▲', '■']
export function rwyLabel(dir: Cell): string {
  return dir.x === 1 ? 'RWY 09' : dir.x === -1 ? 'RWY 27' : dir.y === 1 ? 'RWY 18' : 'RWY 36'
}

/** Storm cells as grid indices. Weather never blocks route *drawing*, but a
 *  plane that flies into it crashes — so the reference router and routability
 *  check treat weather as impassable to guarantee a safe path always exists. */
export function weatherIndexSet(world: World): Set<number> {
  const set = new Set<number>()
  for (const cl of world.clouds) for (const c of cl.cells) set.add(c.y * CONFIG.COLS + c.x)
  return set
}

/* ---------------- pathfinding (8-dir, no corner cutting) ---------------- */
interface DijkstraResult {
  cells: Cell[]
  cost: number
}

export function dijkstra(world: World, from: Cell, to: Cell): DijkstraResult | null {
  const { COLS, ROWS } = CONFIG,
    N = COLS * ROWS,
    I = (c: Cell): number => c.y * COLS + c.x
  // Reference routes avoid both no-fly zones and weather (planes crash in both).
  const weather = weatherIndexSet(world)
  const blk = (idx: number): boolean => world.blocked[idx] === 1 || weather.has(idx)
  if (blk(I(from)) || blk(I(to))) return null
  const D = new Float64Array(N).fill(1e9),
    P = new Int32Array(N).fill(-1),
    V = new Uint8Array(N)
  D[I(from)] = 0
  const MV: [number, number, number][] = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, 1.414],
    [1, -1, 1.414],
    [-1, 1, 1.414],
    [-1, -1, 1.414],
  ]
  for (let n = 0; n < N; n++) {
    let u = -1,
      best = 1e9
    for (let i = 0; i < N; i++)
      if (!V[i] && req(D[i]) < best) {
        best = req(D[i])
        u = i
      }
    if (u < 0 || u === I(to)) break
    V[u] = 1
    const ux = u % COLS,
      uy = (u / COLS) | 0
    for (const [dx, dy, c] of MV) {
      const nx = ux + dx,
        ny = uy + dy
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue
      const v = ny * COLS + nx
      if (blk(v)) continue
      if (dx && dy && (blk(uy * COLS + nx) || blk(ny * COLS + ux))) continue
      if (req(D[u]) + c < req(D[v])) {
        D[v] = req(D[u]) + c
        P[v] = u
      }
    }
  }
  if (req(D[I(to)]) >= 1e9) return null
  const cells: Cell[] = []
  let cur = I(to)
  while (cur !== -1) {
    cells.push({ x: cur % COLS, y: (cur / COLS) | 0 })
    cur = req(P[cur])
  }
  cells.reverse()
  return { cells, cost: req(D[I(to)]) }
}

/* ---------------- world generation ---------------- */
type SpawnCell = Cell & { edge: number }
interface PlanSpec {
  type: PlaneType
  mission: Plane['mission']
}
interface PlanPair {
  spawn: SpawnCell
  target: Target
}
interface BestPlan {
  gates: SpawnCell[]
  plans: PlanPair[]
  cross: number
}

export function generate(seed: number, diff: number): World {
  const C = CONFIG
  outer: for (let attempt = 0; attempt < 40; attempt++) {
    const rng = new Rng(seed * 7919 + attempt * 104729 + diff * 31)
    const world: World = {
      seed,
      diff,
      blocked: new Uint8Array(C.COLS * C.ROWS),
      runways: [],
      gates: [],
      planes: [],
      clouds: [],
      military: null,
      stars: [],
      islands: [],
      hasAirport: false,
    }
    const I = (c: Cell): number => c.y * C.COLS + c.x
    /* --- runways (grid-aligned) --- */
    world.hasAirport = rng.chance(diff === 1 ? 0.85 : 0.72)
    const rwCellsAll: Cell[] = []
    if (world.hasAirport) {
      const mk = (len: number): Runway | null => {
        for (let k = 0; k < 60; k++) {
          const isHoriz = rng.chance(0.55)
          const dir = isHoriz
            ? { x: rng.chance(0.5) ? 1 : -1, y: 0 }
            : { x: 0, y: rng.chance(0.5) ? 1 : -1 }
          const sx = rng.int(2, C.COLS - 3 - (isHoriz ? len : 0)),
            sy = rng.int(1, C.ROWS - 2 - (isHoriz ? 0 : len))
          const cells: Cell[] = []
          let c = {
            x: isHoriz && dir.x < 0 ? sx + len - 1 : sx,
            y: !isHoriz && dir.y < 0 ? sy + len - 1 : sy,
          }
          for (let i = 0; i < len; i++) {
            cells.push({ x: c.x, y: c.y })
            c = { x: c.x + dir.x, y: c.y + dir.y }
          }
          const appr = { x: req(cells[0]).x - dir.x, y: req(cells[0]).y - dir.y }
          if (!inGrid(appr)) continue
          if (
            rwCellsAll.some((o) =>
              cells.some((cc) => Math.max(Math.abs(cc.x - o.x), Math.abs(cc.y - o.y)) < 3)
            )
          )
            continue
          cells.forEach((cc) => rwCellsAll.push(cc))
          return {
            cells,
            dir,
            thr: req(cells[0]),
            end: req(cells[len - 1]),
            appr,
            long: len >= 5,
            label: rwyLabel(dir),
          }
        }
        return null
      }
      const longR = mk(5)
      if (!longR) continue outer
      world.runways.push(longR)
      if (rng.chance(0.4)) {
        const s = mk(3)
        if (s) world.runways.push(s)
      }
    }
    const longIdx = world.runways.findIndex((r) => r.long)
    /* --- roster --- */
    const n = 3
    const typePool = ENABLED_PLANE_KEYS
    let keys: string[]
    if (typePool.length >= 2) {
      keys = []
      for (let k = 0; k < 20; k++) {
        keys = rng.shuffle(typePool).slice(0, n)
        const sp = new Set(keys.map((k2) => req(PLANE_TYPES[k2]).speed))
        if (sp.size >= 2) break
      }
    } else {
      // Single plane type: fill the roster with copies (no speed variety needed).
      keys = Array.from({ length: n }, () => req(typePool[0]))
    }
    const missions: Plane['mission'][] = []
    if (world.hasAirport) {
      missions.push('land')
      if (n >= 2)
        missions.push(diff >= 2 && longIdx >= 0 && rng.chance(0.65) ? 'depart' : 'transit')
      if (n >= 3) missions.push(rng.chance(0.5) ? 'land' : 'transit')
    } else for (let i = 0; i < n; i++) missions.push('transit')
    const spec: PlanSpec[] = keys.map((k, i) => ({
      type: req(PLANE_TYPES[k]),
      mission: req(missions[i]),
    }))
    for (const ps of spec) {
      // big jets need the long runway
      if (
        ps.mission === 'land' &&
        (ps.type.key === 'a380' || ps.type.key === 'b737') &&
        longIdx < 0
      )
        ps.mission = 'transit'
      if (ps.mission === 'depart' && longIdx < 0) ps.mission = 'transit'
    }
    /* --- spawns/gates with crossing guarantee --- */
    const borderCell = (e: number, t: number): Cell =>
      e === 0
        ? { x: Math.round(t * (C.COLS - 1)), y: 0 }
        : e === 1
          ? { x: C.COLS - 1, y: Math.round(t * (C.ROWS - 1)) }
          : e === 2
            ? { x: Math.round(t * (C.COLS - 1)), y: C.ROWS - 1 }
            : { x: 0, y: Math.round(t * (C.ROWS - 1)) }
    const farFrom = (c: Cell, list: Cell[], d: number): boolean =>
      list.every((o) => Math.max(Math.abs(c.x - o.x), Math.abs(c.y - o.y)) >= d)
    let best: BestPlan | null = null
    for (let tryN = 0; tryN < 70; tryN++) {
      const gates: SpawnCell[] = [],
        spawns: SpawnCell[] = [],
        segs: [Vec, Vec][] = [],
        plans: PlanPair[] = []
      let isOk = true
      for (const ps of spec) {
        let spawn: SpawnCell | undefined, target: Target | undefined, segA: Vec
        if (ps.mission === 'depart') {
          const r = req(world.runways[longIdx])
          spawn = { x: r.thr.x, y: r.thr.y, edge: -1 }
          segA = cellC(r.end)
        } else {
          let isPlaced = false
          for (let k = 0; k < 50 && !isPlaced; k++) {
            const e = rng.int(0, 3)
            const base = borderCell(e, rng.range(0.08, 0.92))
            const c: SpawnCell = { x: base.x, y: base.y, edge: e }
            if (farFrom(c, [...spawns, ...gates, ...rwCellsAll], 3)) {
              spawn = c
              isPlaced = true
            }
          }
          if (!isPlaced || !spawn) {
            isOk = false
            break
          }
          segA = cellC(spawn)
        }
        if (ps.mission === 'land') {
          let ri = longIdx
          if (
            (ps.type.key === 'cessna' || ps.type.key === 'jet') &&
            world.runways.length > 1 &&
            rng.chance(0.55)
          )
            ri = world.runways.findIndex((r) => !r.long)
          if (ri < 0) ri = 0
          target = { kind: 'runway', idx: ri }
          segs.push([segA, cellC(req(world.runways[ri]).thr)])
        } else {
          let isPlaced = false
          for (let k = 0; k < 50 && !isPlaced; k++) {
            const e = rng.int(0, 3)
            if (spawn.edge === e) continue
            const base = borderCell(e, rng.range(0.08, 0.92))
            const g: SpawnCell = { x: base.x, y: base.y, edge: e }
            if (farFrom(g, [...gates, ...spawns, ...rwCellsAll], 3)) {
              gates.push(g)
              target = { kind: 'gate', idx: gates.length - 1 }
              isPlaced = true
            }
          }
          if (!isPlaced || !target) {
            isOk = false
            break
          }
          segs.push([segA, cellC(req(gates[gates.length - 1]))])
        }
        plans.push({ spawn, target })
        spawns.push(spawn)
      }
      if (!isOk) continue
      let cross = 0
      for (let i = 0; i < segs.length; i++)
        for (let j = i + 1; j < segs.length; j++)
          if (segInt(req(segs[i])[0], req(segs[i])[1], req(segs[j])[0], req(segs[j])[1])) cross++
      if (!best || cross > best.cross) best = { gates, plans, cross }
      if (cross >= spec.length - 1) break
    }
    if (!best || best.cross < spec.length - 1) continue outer // demand real conflict
    const resolvedBest = best
    world.gates = resolvedBest.gates.map((g, i) => ({
      c: { x: g.x, y: g.y },
      edge: g.edge,
      label: 'GATE ' + 'ABC'[i],
    }))
    spec.forEach((ps, i) => {
      const plan = req(resolvedBest.plans[i])
      world.planes.push({
        id: i,
        type: ps.type,
        mission: ps.mission,
        callsign: ps.type.pre + ' ' + rng.int(10, 99),
        spawn: { x: plan.spawn.x, y: plan.spawn.y },
        edge: plan.spawn.edge,
        target: plan.target,
        rwIdx:
          ps.mission === 'depart' ? longIdx : plan.target.kind === 'runway' ? plan.target.idx : -1,
        color: req(MISSION_COLORS[i]),
        sym: req(MISSION_SYMS[i]),
        bfs: [],
      })
    })
    /* --- protected cells for zone margins --- */
    const prot: Cell[] = []
    world.planes.forEach((p) => prot.push(p.spawn))
    world.gates.forEach((g) => prot.push(g.c))
    world.runways.forEach((r) => {
      r.cells.forEach((c) => prot.push(c))
      prot.push(r.appr)
    })
    const okZoneCell = (c: Cell): boolean =>
      inGrid(c) && prot.every((p) => Math.max(Math.abs(c.x - p.x), Math.abs(c.y - p.y)) >= 2)
    /* --- storm clouds (visual only — they do NOT block, so planes may fly
       through them and no-fly zones may overlap them). Sizes vary and the
       footprint is an irregular ellipse so storms aren't all the same circle. --- */
    const nClouds = diff === 1 ? 1 : diff === 2 ? rng.int(1, 2) : 2
    for (let nn = 0; nn < nClouds; nn++)
      for (let k = 0; k < 80; k++) {
        const cc = { x: rng.int(3, C.COLS - 4), y: rng.int(2, C.ROWS - 3) }
        const isBig = rng.chance(0.35)
        const baseR = isBig ? rng.range(2.0, 3.0) : rng.range(1.0, 1.8)
        const rx = baseR * rng.range(0.8, 1.35),
          ry = baseR * rng.range(0.8, 1.35),
          wob = rng.range(0, TAU)
        const cells: Cell[] = []
        let isGood = true
        for (let y = 0; y < C.ROWS; y++)
          for (let x = 0; x < C.COLS; x++) {
            const dx = x - cc.x,
              dy = y - cc.y,
              stretch = 1 + 0.18 * Math.sin(Math.atan2(dy, dx) * 2 + wob)
            if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= stretch) {
              const c = { x, y }
              if (!okZoneCell(c)) isGood = false
              else cells.push(c)
            }
          }
        if (isGood && cells.length) {
          world.clouds.push({ c: cc, r: baseR, cells })
          break
        }
      }
    /* --- military no-fly rectangle (a real obstacle; may overlap storms) --- */
    if (diff === 3 || (diff === 2 && rng.chance(0.6)))
      for (let k = 0; k < 80; k++) {
        const w = rng.int(3, 5),
          h = rng.int(2, 3),
          x0 = rng.int(1, C.COLS - 1 - w),
          y0 = rng.int(1, C.ROWS - 1 - h)
        let isGood = true
        const cells: Cell[] = []
        for (let y = y0; y < y0 + h; y++)
          for (let x = x0; x < x0 + w; x++) {
            const c = { x, y }
            if (!okZoneCell(c)) isGood = false
            else cells.push(c)
          }
        if (isGood) {
          cells.forEach((c) => (world.blocked[I(c)] = 1))
          world.military = { x0, y0, w, h }
          break
        }
      }
    /* --- routability --- */
    let isRoutable = true
    for (const pl of world.planes) {
      let from = pl.spawn,
        to: Cell
      if (pl.mission === 'land') {
        to = req(world.runways[pl.target.idx]).thr
      } else if (pl.mission === 'depart') {
        const r = req(world.runways[pl.rwIdx])
        from = r.end
        to = req(world.gates[pl.target.idx]).c
      } else to = req(world.gates[pl.target.idx]).c
      const res = dijkstra(world, from, to)
      if (!res) {
        isRoutable = false
        break
      }
      pl.bfs = res.cells
    }
    if (!isRoutable) continue outer
    /* --- stars: bias toward risky spots --- */
    const nStars = diff === 1 ? 2 : 3,
      cand: { c: Cell; sc: number }[] = []
    // Stars may never spawn inside a storm (weather). Collect every cloud cell
    // plus a 1-cell margin so a star can't sit under the cloud's puffy overhang.
    const inWeather = new Set<number>()
    for (const cl of world.clouds)
      for (const cc of cl.cells)
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nb = { x: cc.x + dx, y: cc.y + dy }
            if (inGrid(nb)) inWeather.add(I(nb))
          }
    const DIRS4: [number, number][] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]
    for (let y = 0; y < C.ROWS; y++)
      for (let x = 0; x < C.COLS; x++) {
        const c = { x, y }
        if (world.blocked[I(c)]) continue
        if (inWeather.has(I(c))) continue
        if (rwCellsAll.some((o) => sameCell(o, c))) continue
        if (!prot.every((p) => Math.max(Math.abs(c.x - p.x), Math.abs(c.y - p.y)) >= 2)) continue
        if (x === 0 || y === 0 || x === C.COLS - 1 || y === C.ROWS - 1) continue
        let sc = rng.f()
        for (const [dx, dy] of DIRS4) {
          const nb = { x: x + dx, y: y + dy }
          if (inGrid(nb) && world.blocked[I(nb)]) {
            sc += 1
            break
          }
        }
        cand.push({ c, sc })
      }
    cand.sort((a, b) => b.sc - a.sc)
    for (const k of cand) {
      if (world.stars.length >= nStars) break
      if (world.stars.every((s) => Math.max(Math.abs(s.c.x - k.c.x), Math.abs(s.c.y - k.c.y)) >= 3))
        world.stars.push({ c: k.c })
    }
    /* --- island art (px, decorative) --- */
    world.runways.forEach((r) => {
      const a = cellC(r.thr),
        b = cellC(r.end)
      world.islands.push({
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        r: dist(a, b) * 0.62 + 40,
        seed: rng.int(1, 999),
      })
    })
    if (world.military) {
      const m = world.military
      world.islands.push({
        x: C.X0 + (m.x0 + m.w / 2) * C.CELL,
        y: C.Y0 + (m.y0 + m.h / 2) * C.CELL,
        r: Math.max(m.w, m.h) * C.CELL * 0.75,
        seed: rng.int(1, 999),
      })
    }
    for (let nn = 0; nn < rng.int(2, 3); nn++) {
      const isl: Island = {
        x: rng.range(C.X0 + 80, C.X0 + C.COLS * C.CELL - 80),
        y: rng.range(C.Y0 + 70, C.Y0 + C.ROWS * C.CELL - 70),
        r: rng.range(40, 80),
        seed: rng.int(1, 999),
      }
      if (world.islands.every((o) => dist(o, isl) > o.r + isl.r)) world.islands.push(isl)
    }
    return world
  }
  return generate(seed + 1, Math.max(1, diff - 1))
}

/* ---------------- deterministic simulation ---------------- */
function buildRunPts(world: World, pl: Plane, sol: PlanePath): Vec[] {
  let cells = sol.cells
  if (pl.mission === 'land') {
    const r = req(world.runways[pl.target.idx])
    cells = cells.concat([
      { x: r.thr.x + r.dir.x, y: r.thr.y + r.dir.y },
      { x: r.thr.x + r.dir.x * 2, y: r.thr.y + r.dir.y * 2 },
    ])
  }
  return cells.map(cellC)
}

export class Sim {
  public readonly world: World
  public t: number
  public violations: number
  private readonly sepState: Record<string, boolean>
  private readonly starsTaken: boolean[]
  private readonly weather: Set<number>
  public readonly planes: SimPlane[]

  public constructor(world: World, solution: BonkAirSolution) {
    this.world = world
    this.t = 0
    this.violations = 0
    this.sepState = {}
    this.starsTaken = new Array<boolean>(world.stars.length).fill(false)
    this.weather = weatherIndexSet(world)
    this.planes = world.planes.map((pl) => {
      const sol = solution[pl.id]
      if (!sol || !sol.cells || sol.cells.length < 2) {
        const home = cellC(pl.spawn)
        return {
          ref: pl,
          id: pl.id,
          type: pl.type,
          color: pl.color,
          sym: pl.sym,
          state: 'home',
          x: home.x,
          y: home.y,
          ang: 0,
          stars: 0,
          trail: [],
          pts: [],
          cums: [],
          total: 0,
          drawn: 0,
          landS: 1e9,
          liftS: 0,
          complete: false,
          s: 0,
        }
      }
      const pts = buildRunPts(world, pl, sol),
        cums = cumLens(pts)
      const drawn = req(cums[sol.cells.length - 1]) // px the player actually drew (fuel basis)
      let liftS = 0
      if (pl.mission === 'depart') {
        const r = req(world.runways[pl.rwIdx])
        liftS = req(cums[r.cells.length - 1])
      }
      return {
        ref: pl,
        id: pl.id,
        type: pl.type,
        color: pl.color,
        sym: pl.sym,
        pts,
        cums,
        total: req(cums[cums.length - 1]),
        drawn,
        landS: pl.mission === 'land' ? drawn : 1e9,
        liftS,
        complete: Boolean(sol.complete),
        s: 0,
        x: req(pts[0]).x,
        y: req(pts[0]).y,
        ang: 0,
        state: 'flying',
        stars: 0,
        trail: [],
      }
    })
  }

  public rolling(p: SimPlane): boolean {
    return p.s >= p.landS - 1 || p.s <= p.liftS
  }
  public active(): SimPlane[] {
    return this.planes.filter((p) => p.state === 'flying')
  }
  public finished(): boolean {
    return this.planes.every((p) => p.state !== 'flying') || this.t > CONFIG.MAX_SIM_T
  }

  public step(dt: number): SimEvent[] {
    this.t += dt
    const ev: SimEvent[] = [],
      CELL = CONFIG.CELL
    for (const p of this.active()) {
      p.s += p.type.speed * CELL * dt
      const pos = pointAlong(p.pts, p.cums, Math.min(p.s, p.total))
      p.x = pos.x
      p.y = pos.y
      p.ang = pos.ang
      if (p.s >= p.total) {
        if (p.complete) {
          p.state = 'done'
          ev.push({
            type: 'done',
            p,
            t: this.t,
            kind: p.ref.mission === 'land' ? 'runway' : 'gate',
            mission: p.ref.mission,
          })
        } else {
          p.state = 'lost'
          ev.push({ type: 'lost', p, t: this.t })
        }
      }
    }
    // No-fly zone OR weather entry: the plane crashes. Drawing through a no-fly
    // zone is impossible, but weather can be drawn through — so flying into a
    // storm is a fatal mistake the player must route around.
    for (const p of this.active()) {
      if (this.rolling(p)) continue
      const c = pxCell(p)
      if (!inGrid(c)) continue
      const idx = c.y * CONFIG.COLS + c.x
      if (this.world.blocked[idx]) {
        // No-fly zone → the plane is intercepted (blue banner).
        p.state = 'crashed'
        ev.push({
          type: 'bonk',
          a: p,
          b: null,
          x: p.x,
          y: p.y,
          t: this.t,
          zone: true,
          intercept: true,
        })
      } else if (this.weather.has(idx)) {
        // Storm → the plane bonks (red banner).
        p.state = 'crashed'
        ev.push({ type: 'bonk', a: p, b: null, x: p.x, y: p.y, t: this.t, zone: true })
      }
    }
    // separation + collisions (planes)
    const airborne = this.active().filter((p) => !this.rolling(p))
    const sepCheck = (a: SimPlane, b: SimPlane | Vec, key: string, heli: boolean): void => {
      const d = dist(a, b)
      if (d < CONFIG.BONK_BLOCKS * CELL) {
        a.state = 'crashed'
        if (!heli && (b as SimPlane).state) (b as SimPlane).state = 'crashed'
        ev.push({
          type: 'bonk',
          a,
          b: heli ? null : (b as SimPlane),
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
          t: this.t,
          heli,
        })
      } else if (d < CONFIG.SEP_BLOCKS * CELL) {
        if (this.sepState[key] !== false) {
          this.sepState[key] = false
          this.violations++
          ev.push({ type: 'sep', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, t: this.t, heli })
        }
      } else if (d > CONFIG.SEP_REARM * CELL) this.sepState[key] = true
    }
    for (let i = 0; i < airborne.length; i++)
      for (let j = i + 1; j < airborne.length; j++)
        sepCheck(
          req(airborne[i]),
          req(airborne[j]),
          req(airborne[i]).id + '-' + req(airborne[j]).id,
          false
        )
    // stars
    for (const p of airborne)
      if (p.state === 'flying')
        this.world.stars.forEach((st, si) => {
          if (!this.starsTaken[si] && dist(p, cellC(st.c)) < CELL * 0.7) {
            this.starsTaken[si] = true
            p.stars++
            ev.push({ type: 'star', p, x: cellC(st.c).x, y: cellC(st.c).y, si, t: this.t })
          }
        })
    return ev
  }

  public results(): SimResults {
    const per: PlaneResult[] = this.planes.map((p) => {
      const isDone = p.state === 'done'
      return {
        id: p.id,
        callsign: p.ref.callsign,
        label: p.type.label,
        color: p.color,
        sym: p.sym,
        state: p.state,
        mission: p.ref.mission,
        base: isDone ? CONFIG.PTS_DONE : 0,
        stars: p.stars * CONFIG.PTS_STAR,
      }
    })
    const perfect =
      this.planes.every((p) => p.state === 'done') && this.violations === 0 ? CONFIG.PTS_PERFECT : 0
    const penalty = this.violations * CONFIG.SEP_PENALTY
    const sub = per.reduce((s, r) => s + r.base + r.stars, 0)
    return { per, perfect, violations: this.violations, penalty, score: sub + perfect - penalty }
  }
}

export function runHeadless(world: World, solution: BonkAirSolution): SimResults {
  const sim = new Sim(world, solution)
  while (!sim.finished()) sim.step(CONFIG.SIM_DT)
  return sim.results()
}

/* ---------------- seed + scoring ---------------- */
/** Hash the engine's string seed into a uint32 for the numeric RNG (FNV-1a). */
export function hashSeed(s: string): number {
  let h = FNV_OFFSET >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, FNV_PRIME)
  }
  return h >>> 0
}

/**
 * Server-authoritative scoring: regenerate the world from the puzzle seed, run
 * the headless sim on the submitted plan, and add the quick-planning bonus from
 * the server-measured answer time (only when every plane was fully routed).
 */
export function scoreBonkAirSolution(
  puzzle: BonkAirPuzzle,
  solution: BonkAirSolution,
  config: BonkAirScoreConfig,
  timeToAnswerMs: number
): BonkAirScoreResult {
  const world = generate(hashSeed(puzzle.seed), puzzle.diff)
  const results = runHeadless(world, solution)
  const isAllComplete =
    world.planes.length > 0 &&
    world.planes.every((p) => {
      const path = solution[p.id]
      return path?.complete === true
    })
  const secondsLeft = Math.floor((config.timeLimitMs - timeToAnswerMs) / MS_PER_SECOND)
  const earlyBonus = isAllComplete
    ? Math.min(config.earlyMax, Math.max(0, secondsLeft) * CONFIG.EARLY_PER_SECOND)
    : 0
  return { score: results.score + earlyBonus, earlyBonus, results, allComplete: isAllComplete }
}
