/**
 * Imperative Bonk Air runtime: canvas rendering, grid path-drawing input, and
 * the flight-deck HUD. Ported from the standalone prototype's renderer/input/UI
 * layer. The standalone shell (title, difficulty/seed pickers, briefing, results
 * overlay, host-demo leaderboard) is dropped — the Brain Wiz platform owns the
 * round flow, timing, scoring, and leaderboard. This module is deliberately
 * framework-free; `BonkAir.tsx` wires it to React refs and props.
 */
import {
  CONFIG,
  Rng,
  Sim,
  TAU,
  cellC,
  clamp,
  dist,
  generate,
  hashSeed,
  inGrid,
  pxCell,
  sameCell,
  type BonkAirPuzzle,
  type BonkAirSubmission,
  type Cell,
  type Plane,
  type PlanePath,
  type Vec,
  type World,
} from '../shared/bonkAirGame.js'
import { type SimEvent } from '../shared/bonkAirGame.types.js'

/**
 * Treat an indexed / optional access as present. Indices in this renderer are
 * guaranteed valid by construction, so this is a type-only narrowing that
 * preserves the exact runtime semantics of the non-null assertions it replaces
 * (it never throws), letting the renderer tolerate a malformed/partial plan
 * exactly as before instead of crashing on it.
 */
function req<T>(value: T | undefined | null): T {
  return value as T
}

/** Resolve a canvas 2D context or throw — keeps the non-null type across closures. */
function get2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('2d context unavailable')
  return context
}

const FONT =
  "ui-rounded,'Hiragino Maru Gothic ProN','Quicksand','Trebuchet MS',system-ui,sans-serif"
const MONO = "ui-monospace,'SF Mono','Cascadia Mono',Menlo,Consolas,monospace"
const LOW_TIME = 10

export interface BonkAirRuntimeOptions {
  root: HTMLElement
  canvas: HTMLCanvasElement
  puzzle: BonkAirPuzzle
  readOnly: boolean
  onSubmissionChange?: (submission: BonkAirSubmission) => void
  onCommit?: (submission: BonkAirSubmission) => void
  onReplayComplete?: () => void
}

export interface BonkAirRuntime {
  setPhase: (phase: 'playing' | 'reveal') => void
  destroy: () => void
}

interface DrawOpts {
  scale?: number
  noShadow?: boolean
  ghost?: boolean
  dizzy?: number
  spin?: number
}

interface Fx {
  kind: string
  t: number
  x?: number
  y?: number
  txt?: string
  color?: string
  size?: number
  ang?: number
  type?: Plane['type']
  vx?: number
  parts?: { vx: number; vy: number; col: string }[]
}

type GamePhase = 'plan' | 'locked' | 'sim' | 'done'

interface DrawingStroke {
  id: number
  prev: PlanePath | null
  moved: boolean
  minLen: number
}

interface TapCell {
  c: Cell
  x: number
  y: number
}

interface GhostFx {
  x: number
  y: number
  t: number
  sep?: boolean
}

interface UndoEntry {
  id: number
  prev: PlanePath | null
}

interface GameState {
  phase: GamePhase
  world: World
  paths: Record<number, PlanePath>
  undoStack: UndoEntry[]
  drawing: DrawingStroke | null
  selected: number | null
  tapCell: TapCell | null
  planLeft: number
  clock: number
  sim: Sim | null
  acc: number
  simSpeed: number
  ghost: Sim | null
  ghostOn: boolean
  ghostAcc: number
  ghostWait: number
  fx: Fx[]
  ghostFx: GhostFx[]
  runningScore: number
  endHandled: boolean
  blockFlashAt: number
  lastWhole: number
}

export function createBonkAirRuntime(opts: BonkAirRuntimeOptions): BonkAirRuntime {
  const {
    root,
    canvas,
    puzzle,
    readOnly: isReadOnly,
    onSubmissionChange,
    onCommit,
    onReplayComplete,
  } = opts
  const ctx = get2dContext(canvas)
  const q = <T extends HTMLElement>(sel: string): T | null => root.querySelector<T>(sel)

  /* ---------------- audio (disabled for now: all no-ops) ---------------- */
  const Sfx = {
    ensure(): void {
      /* no-op: audio disabled in platform build */
    },
    honk(): void {
      /* no-op: audio disabled in platform build */
    },
    plop(): void {
      /* no-op: audio disabled in platform build */
    },
    snapOk(): void {
      /* no-op: audio disabled in platform build */
    },
    bonk(): void {
      /* no-op: audio disabled in platform build */
    },
    tada(): void {
      /* no-op: audio disabled in platform build */
    },
    tick(): void {
      /* no-op: audio disabled in platform build */
    },
    alert(): void {
      /* no-op: audio disabled in platform build */
    },
    star(): void {
      /* no-op: audio disabled in platform build */
    },
    lost(): void {
      /* no-op: audio disabled in platform build */
    },
    buzz(): void {
      /* no-op: audio disabled in platform build */
    },
  }

  /* ---------------- state ---------------- */
  const world: World = generate(hashSeed(puzzle.seed), puzzle.diff)
  const G: GameState = {
    phase: 'plan',
    world,
    paths: {},
    undoStack: [],
    drawing: null,
    selected: null,
    tapCell: null,
    planLeft: CONFIG.PLAN_SECONDS,
    clock: 0,
    sim: null,
    acc: 0,
    simSpeed: 1,
    ghost: null,
    ghostOn: false,
    ghostAcc: 0,
    ghostWait: 0,
    fx: [],
    ghostFx: [],
    runningScore: 0,
    endHandled: false,
    blockFlashAt: 0,
    lastWhole: CONFIG.PLAN_SECONDS + 1,
  }
  const VIEW = { scale: 1 }
  let bgCache: HTMLCanvasElement | null = null
  let rafId = 0
  let lastT = performance.now()
  let isDestroyed = false

  /* ---------------- helpers ---------------- */
  const vibrate = (ms: number): void => {
    if (navigator.vibrate) navigator.vibrate(ms)
  }
  const DEFAULT_TOAST_MS = 1900
  function toast(msg: string, ms = DEFAULT_TOAST_MS): void {
    const t = q<HTMLElement & { _h?: ReturnType<typeof setTimeout> }>('.ba-toast')
    if (!t) return
    t.textContent = msg
    t.classList.add('show')
    clearTimeout(t._h)
    t._h = setTimeout(() => t.classList.remove('show'), ms)
  }
  const addFx = (kind: string, props: Partial<Fx>): void => {
    G.fx.push({ kind, t: 0, ...props })
  }
  const targetCellOf = (pl: Plane, W: World): Cell =>
    pl.mission === 'land' ? req(W.runways[pl.target.idx]).thr : req(W.gates[pl.target.idx]).c
  const planeHome = (pl: Plane, W: World): Vec =>
    pl.mission === 'depart' ? cellC(req(W.runways[pl.rwIdx]).thr) : cellC(pl.spawn)
  const pathPts = (sol: PlanePath): Vec[] => sol.cells.map(cellC)
  function poly(pts: Vec[]): void {
    ctx.beginPath()
    const first = req(pts[0])
    ctx.moveTo(first.x, first.y)
    for (let i = 1; i < pts.length; i++) {
      const pt = req(pts[i])
      ctx.lineTo(pt.x, pt.y)
    }
  }
  function roundRectPath(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    c.beginPath()
    c.moveTo(x + r, y)
    c.arcTo(x + w, y, x + w, y + h, r)
    c.arcTo(x + w, y + h, x, y + h, r)
    c.arcTo(x, y + h, x, y, r)
    c.arcTo(x, y, x + w, y, r)
    c.closePath()
  }
  function symChip(x: number, y: number, pl: Plane, scale = 1): void {
    const chipHalf = 11,
      chipSize = 22,
      chipRadius = 7,
      chipBorderWidth = 2,
      chipFontSize = 13,
      chipTextBaselineY = 4.5
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(scale, scale)
    ctx.fillStyle = pl.color
    roundRectPath(ctx, -chipHalf, -chipHalf, chipSize, chipSize, chipRadius)
    ctx.fill()
    ctx.strokeStyle = 'rgba(16,24,32,.55)'
    ctx.lineWidth = chipBorderWidth
    roundRectPath(ctx, -chipHalf, -chipHalf, chipSize, chipSize, chipRadius)
    ctx.stroke()
    ctx.fillStyle = '#101820'
    ctx.font = '800 ' + chipFontSize + 'px ' + FONT
    ctx.textAlign = 'center'
    ctx.fillText(pl.sym, 0, chipTextBaselineY)
    ctx.restore()
  }

  /* ---------------- aircraft art ---------------- */
  function drawPlane(
    c: CanvasRenderingContext2D,
    type: Plane['type'],
    x: number,
    y: number,
    ang: number,
    color: string,
    o: DrawOpts = {}
  ): void {
    const shadowOffsetX = 5,
      shadowOffsetY = 7,
      shadowRadiusXRatio = 1.7,
      shadowRadiusYRatio = 1.05,
      ghostAlpha = 0.45,
      dizzyFreq = 14,
      dizzyAmp = 0.6
    const s = o.scale ?? 1,
      r = type.r
    if (!o.noShadow) {
      c.save()
      c.translate(x + shadowOffsetX, y + shadowOffsetY)
      c.rotate(ang)
      c.scale(s, s)
      c.fillStyle = 'rgba(8,14,20,.25)'
      c.beginPath()
      c.ellipse(0, 0, r * shadowRadiusXRatio, r * shadowRadiusYRatio, 0, 0, TAU)
      c.fill()
      c.restore()
    }
    c.save()
    c.translate(x, y)
    c.rotate(ang)
    c.scale(s, s)
    if (o.ghost) c.globalAlpha = ghostAlpha
    if (o.dizzy) c.rotate(Math.sin(o.dizzy * dizzyFreq) * dizzyAmp)
    const bodyWideRatio = 1.4,
      bodyNarrowRatio = 1.02,
      lengthRatio = 3.1,
      spanWideRatio = 3.5,
      spanCessnaRatio = 3.0,
      spanDefaultRatio = 2.8
    const bodyW = type.key === 'a380' ? r * bodyWideRatio : r * bodyNarrowRatio,
      L = r * lengthRatio
    const spanOf = (): number =>
      type.key === 'a380'
        ? r * spanWideRatio
        : type.key === 'cessna'
          ? r * spanCessnaRatio
          : r * spanDefaultRatio
    const span = spanOf()
    const outlineWidth = 2,
      wingRootXRatio = 0.45,
      wingTipXRatio = 1.0,
      wingTrailXRatio = 0.5,
      wingRearXRatio = 0.25,
      wingRootYRatio = 0.4,
      tailRootXRatio = 0.1,
      tailTipXRatio = 0.8,
      tailHeightRatio = 1.0,
      tailRootYRatio = 0.3
    c.lineWidth = outlineWidth
    c.strokeStyle = 'rgba(10,18,26,.5)'
    c.fillStyle = color
    c.beginPath() // wings (swept)
    c.moveTo(r * wingRootXRatio, -span / 2)
    c.lineTo(r * wingTipXRatio, -bodyW * wingRootYRatio)
    c.lineTo(-r * wingTrailXRatio, -bodyW * wingRootYRatio)
    c.lineTo(-r * wingRearXRatio, -span / 2)
    c.closePath()
    c.fill()
    c.stroke()
    c.beginPath()
    c.moveTo(r * wingRootXRatio, span / 2)
    c.lineTo(r * wingTipXRatio, bodyW * wingRootYRatio)
    c.lineTo(-r * wingTrailXRatio, bodyW * wingRootYRatio)
    c.lineTo(-r * wingRearXRatio, span / 2)
    c.closePath()
    c.fill()
    c.stroke()
    c.beginPath() // tailplane
    c.moveTo(-L / 2 + r * tailRootXRatio, -r * tailHeightRatio)
    c.lineTo(-L / 2 + r * tailTipXRatio, -bodyW * tailRootYRatio)
    c.lineTo(-L / 2 + r * tailTipXRatio, bodyW * tailRootYRatio)
    c.lineTo(-L / 2 + r * tailRootXRatio, r * tailHeightRatio)
    c.closePath()
    c.fill()
    c.stroke()
    c.fillStyle = '#EDF2F6'
    const nacXRatio = 0.32,
      nacYRatio = 0.18,
      nacWRatio = 0.64,
      nacHRatio = 0.36,
      nacRRatio = 0.16
    const nac = (wx: number, wy: number): void => {
      roundRectPath(
        c,
        wx - r * nacXRatio,
        wy - r * nacYRatio,
        r * nacWRatio,
        r * nacHRatio,
        r * nacRRatio
      )
      c.fill()
      c.stroke()
    }
    const drawNacelles = (): void => {
      const b737NacXRatio = 0.38,
        b737NacSpanRatio = 0.26,
        a380NacOuterXRatio = 0.42,
        a380NacOuterSpanRatio = 0.32,
        a380NacInnerXRatio = 0.22,
        a380NacInnerSpanRatio = 0.17,
        jetNacXRatio = 0.9,
        jetNacBodyRatio = 0.72
      if (type.key === 'b737') {
        nac(r * b737NacXRatio, -span * b737NacSpanRatio)
        nac(r * b737NacXRatio, span * b737NacSpanRatio)
      }
      if (type.key === 'a380') {
        nac(r * a380NacOuterXRatio, -span * a380NacOuterSpanRatio)
        nac(r * a380NacInnerXRatio, -span * a380NacInnerSpanRatio)
        nac(r * a380NacInnerXRatio, span * a380NacInnerSpanRatio)
        nac(r * a380NacOuterXRatio, span * a380NacOuterSpanRatio)
      }
      if (type.key === 'jet') {
        nac(-L / 2 + r * jetNacXRatio, -bodyW * jetNacBodyRatio)
        nac(-L / 2 + r * jetNacXRatio, bodyW * jetNacBodyRatio)
      }
    }
    drawNacelles()
    c.fillStyle = '#EDF2F6' // fuselage
    roundRectPath(c, -L / 2, -bodyW / 2, L, bodyW, bodyW / 2)
    c.fill()
    c.stroke()
    const stripeXRatio = 0.4,
      stripeYRatio = 0.5,
      stripeLengthRatio = 0.16,
      windscreenXRatio = 1.15,
      windscreenYRatio = 0.3,
      windscreenWRatio = 0.55,
      windscreenHRatio = 0.6,
      windscreenRRatio = 0.2
    c.fillStyle = color // nose + stripe
    c.beginPath()
    c.arc(L / 2 - bodyW / 2, 0, bodyW / 2, -Math.PI / 2, Math.PI / 2)
    c.fill()
    c.fillRect(-L / 2 + bodyW * stripeXRatio, -bodyW * stripeYRatio, L * stripeLengthRatio, bodyW)
    c.fillStyle = '#22313F' // windscreen
    roundRectPath(
      c,
      L / 2 - bodyW * windscreenXRatio,
      -bodyW * windscreenYRatio,
      bodyW * windscreenWRatio,
      bodyW * windscreenHRatio,
      bodyW * windscreenRRatio
    )
    c.fill()
    const drawProp = (): void => {
      if (type.key === 'cessna') {
        const propLineWidth = 2.2,
          propSpinRate = 22,
          propRadiusRatio = 0.85
        c.strokeStyle = 'rgba(20,30,40,.65)'
        c.lineWidth = propLineWidth
        const a = (o.spin ?? 0) * propSpinRate
        c.beginPath()
        c.moveTo(L / 2 + Math.cos(a) * r * propRadiusRatio, Math.sin(a) * r * propRadiusRatio)
        c.lineTo(L / 2 - Math.cos(a) * r * propRadiusRatio, -Math.sin(a) * r * propRadiusRatio)
        c.stroke()
      }
    }
    drawProp()
    c.restore()
  }
  function drawStarShape(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    R: number,
    rot: number,
    fill: string
  ): void {
    const STAR_POINTS_X2 = 10,
      STAR_INNER_RADIUS_RATIO = 0.45,
      STAR_ANGLE_DIVISOR = 5,
      starOutlineWidth = 2
    c.save()
    c.translate(x, y)
    c.rotate(rot)
    c.beginPath()
    for (let i = 0; i < STAR_POINTS_X2; i++) {
      const rr2 = i % 2 ? R * STAR_INNER_RADIUS_RATIO : R,
        a = (i * Math.PI) / STAR_ANGLE_DIVISOR - Math.PI / 2
      if (i) c.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2)
      else c.moveTo(Math.cos(a) * rr2, Math.sin(a) * rr2)
    }
    c.closePath()
    c.fillStyle = fill
    c.fill()
    c.strokeStyle = 'rgba(10,18,26,.4)'
    c.lineWidth = starOutlineWidth
    c.stroke()
    c.restore()
  }
  /* ---------------- background cache ---------------- */
  function buildBg(W: World): HTMLCanvasElement {
    const C = CONFIG,
      off = document.createElement('canvas')
    off.width = C.W
    off.height = C.H
    const b = get2dContext(off)
    const gx0 = C.X0,
      gy0 = C.Y0,
      gw = C.COLS * C.CELL,
      gh = C.ROWS * C.CELL
    b.fillStyle = '#101820'
    b.fillRect(0, 0, C.W, C.H)
    const g = b.createLinearGradient(0, gy0, 0, gy0 + gh)
    const GRADIENT_TOP_STOP = 0,
      GRADIENT_BOTTOM_STOP = 1
    g.addColorStop(GRADIENT_TOP_STOP, '#3A7E92')
    g.addColorStop(GRADIENT_BOTTOM_STOP, '#2C6376')
    b.fillStyle = g
    b.fillRect(gx0, gy0, gw, gh)
    const ISLAND_SEED_MULT = 13,
      ISLAND_SEED_ADD = 7
    const rr = new Rng(W.seed * ISLAND_SEED_MULT + ISLAND_SEED_ADD)
    const BLOB_ANGLE_PAD = 0.01,
      BLOB_ANGLE_STEPS = 22,
      BLOB_WOBBLE1_AMP = 0.11,
      BLOB_WOBBLE1_FREQ = 3,
      BLOB_WOBBLE2_AMP = 0.06,
      BLOB_WOBBLE2_FREQ = 5,
      BLOB_SEED2_MULT = 2,
      BLOB_Y_SQUASH = 0.85,
      ISLAND_SAND_RATIO = 1.12,
      DETAIL_PER_RADIUS = 20,
      DETAIL_MIN_DIST_RATIO = 0.2,
      DETAIL_MAX_DIST_RATIO = 0.75,
      DETAIL_MIN_SIZE = 3,
      DETAIL_MAX_SIZE = 7
    const drawIslands = (): void => {
      for (const isl of W.islands) {
        const blob = (rad: number, fill: string): void => {
          b.beginPath()
          for (let a = 0; a <= TAU + BLOB_ANGLE_PAD; a += TAU / BLOB_ANGLE_STEPS) {
            const w =
              1 +
              BLOB_WOBBLE1_AMP * Math.sin(a * BLOB_WOBBLE1_FREQ + isl.seed) +
              BLOB_WOBBLE2_AMP * Math.sin(a * BLOB_WOBBLE2_FREQ + isl.seed * BLOB_SEED2_MULT)
            const px = isl.x + Math.cos(a) * rad * w,
              py = isl.y + Math.sin(a) * rad * w * BLOB_Y_SQUASH
            if (a === 0) b.moveTo(px, py)
            else b.lineTo(px, py)
          }
          b.closePath()
          b.fillStyle = fill
          b.fill()
        }
        b.save()
        b.beginPath()
        b.rect(gx0, gy0, gw, gh)
        b.clip()
        blob(isl.r * ISLAND_SAND_RATIO, '#E4D2A1')
        blob(isl.r, '#7FB06B')
        b.fillStyle = '#6B9A59'
        for (let t = 0; t < isl.r / DETAIL_PER_RADIUS; t++) {
          const a = rr.range(0, TAU),
            d = rr.range(DETAIL_MIN_DIST_RATIO, DETAIL_MAX_DIST_RATIO) * isl.r
          b.beginPath()
          b.arc(
            isl.x + Math.cos(a) * d,
            isl.y + Math.sin(a) * d * BLOB_Y_SQUASH,
            rr.range(DETAIL_MIN_SIZE, DETAIL_MAX_SIZE),
            0,
            TAU
          )
          b.fill()
        }
        b.restore()
      }
    }
    drawIslands()
    // grid + coordinates
    const drawGrid = (): void => {
      const GRID_MAJOR_EVERY = 4,
        GRID_MAJOR_WIDTH = 1.6,
        GRID_MINOR_WIDTH = 0.8,
        LABEL_FONT_SIZE = 10,
        ASCII_A = 65,
        CELL_CENTER = 0.5,
        COL_LABEL_OFFSET_Y = 5,
        ROW_LABEL_OFFSET_X = 5,
        ROW_LABEL_OFFSET_Y = 3
      b.strokeStyle = 'rgba(235,248,252,0.10)'
      for (let i = 0; i <= C.COLS; i++) {
        b.lineWidth = i % GRID_MAJOR_EVERY === 0 ? GRID_MAJOR_WIDTH : GRID_MINOR_WIDTH
        b.beginPath()
        b.moveTo(gx0 + i * C.CELL, gy0)
        b.lineTo(gx0 + i * C.CELL, gy0 + gh)
        b.stroke()
      }
      for (let j = 0; j <= C.ROWS; j++) {
        b.lineWidth = j % GRID_MAJOR_EVERY === 0 ? GRID_MAJOR_WIDTH : GRID_MINOR_WIDTH
        b.beginPath()
        b.moveTo(gx0, gy0 + j * C.CELL)
        b.lineTo(gx0 + gw, gy0 + j * C.CELL)
        b.stroke()
      }
      b.fillStyle = 'rgba(235,248,252,0.30)'
      b.font = '700 ' + LABEL_FONT_SIZE + 'px ' + MONO
      b.textAlign = 'center'
      for (let i = 0; i < C.COLS; i++)
        b.fillText(
          String.fromCharCode(ASCII_A + i),
          gx0 + (i + CELL_CENTER) * C.CELL,
          gy0 - COL_LABEL_OFFSET_Y
        )
      b.textAlign = 'right'
      for (let j = 0; j < C.ROWS; j++)
        b.fillText(
          String(j + 1),
          gx0 - ROW_LABEL_OFFSET_X,
          gy0 + (j + CELL_CENTER) * C.CELL + ROW_LABEL_OFFSET_Y
        )
      b.textAlign = 'left'
    }
    drawGrid()
    const drawMilitary = (): void => {
      if (W.military) {
        const MIL_OUTER_INSET = 4,
          MIL_OUTER_TRIM = 8,
          MIL_OUTER_RADIUS = 10,
          MIL_HATCH_WIDTH = 7,
          MIL_HATCH_STEP = 24,
          MIL_INNER_INSET = 10,
          MIL_INNER_TRIM = 20,
          MIL_INNER_RADIUS = 8,
          MIL_LABEL_FONT_SIZE = 13,
          MIL_LABEL_OFFSET_Y = 4
        const m = W.military
        const x = gx0 + m.x0 * C.CELL,
          y = gy0 + m.y0 * C.CELL,
          w = m.w * C.CELL,
          h = m.h * C.CELL
        b.fillStyle = '#55606C'
        roundRectPath(
          b,
          x + MIL_OUTER_INSET,
          y + MIL_OUTER_INSET,
          w - MIL_OUTER_TRIM,
          h - MIL_OUTER_TRIM,
          MIL_OUTER_RADIUS
        )
        b.fill()
        b.save()
        b.beginPath()
        roundRectPath(
          b,
          x + MIL_OUTER_INSET,
          y + MIL_OUTER_INSET,
          w - MIL_OUTER_TRIM,
          h - MIL_OUTER_TRIM,
          MIL_OUTER_RADIUS
        )
        b.clip()
        b.strokeStyle = 'rgba(255,92,92,.5)'
        b.lineWidth = MIL_HATCH_WIDTH
        for (let k = -h; k < w + h; k += MIL_HATCH_STEP) {
          b.beginPath()
          b.moveTo(x + k, y)
          b.lineTo(x + k + h, y + h)
          b.stroke()
        }
        b.restore()
        b.fillStyle = '#39424E'
        roundRectPath(
          b,
          x + MIL_INNER_INSET,
          y + MIL_INNER_INSET,
          w - MIL_INNER_TRIM,
          h - MIL_INNER_TRIM,
          MIL_INNER_RADIUS
        )
        b.fill()
        b.fillStyle = '#FF8C8C'
        b.font = '800 ' + MIL_LABEL_FONT_SIZE + 'px ' + MONO
        b.textAlign = 'center'
        b.fillText('NO FLY ZONE', x + w / 2, y + h / 2 + MIL_LABEL_OFFSET_Y)
      }
    }
    drawMilitary()
    const drawRunways = (): void => {
      const RUNWAY_LEN_PAD_RATIO = 0.9,
        RUNWAY_WIDTH_RATIO = 0.78,
        RUNWAY_RADIUS = 8,
        RUNWAY_DASH_WIDTH = 3,
        RUNWAY_CENTERLINE_INSET = 16,
        RUNWAY_LABEL_INSET = 12,
        RUNWAY_THRESHOLD_BARS = 4,
        RUNWAY_BAR_X_OFFSET = 6,
        RUNWAY_BAR_Y_INSET = 5,
        RUNWAY_BAR_SPAN_TRIM = 10,
        RUNWAY_BAR_SPACING_DIVISOR = 3.4,
        RUNWAY_BAR_WIDTH = 11,
        RUNWAY_BAR_HEIGHT = 4,
        RUNWAY_LABEL_FONT_SIZE = 12,
        RUNWAY_LABEL_OFFSET_Y = 8,
        RUNWAY_DASH_ON = 14,
        RUNWAY_DASH_OFF = 12
      const RUNWAY_DASH: [number, number] = [RUNWAY_DASH_ON, RUNWAY_DASH_OFF]
      for (const r of W.runways) {
        const a = cellC(r.thr),
          e = cellC(r.end),
          isHoriz = r.dir.y === 0
        const len = dist(a, e) + C.CELL * RUNWAY_LEN_PAD_RATIO,
          wid = C.CELL * RUNWAY_WIDTH_RATIO
        b.save()
        b.translate((a.x + e.x) / 2, (a.y + e.y) / 2)
        if (!isHoriz) b.rotate(Math.PI / 2)
        const sgn = isHoriz ? r.dir.x : r.dir.y
        b.fillStyle = '#39424E'
        roundRectPath(b, -len / 2, -wid / 2, len, wid, RUNWAY_RADIUS)
        b.fill()
        b.strokeStyle = 'rgba(244,235,216,.8)'
        b.lineWidth = RUNWAY_DASH_WIDTH
        b.setLineDash(RUNWAY_DASH)
        b.beginPath()
        b.moveTo(-len / 2 + RUNWAY_CENTERLINE_INSET, 0)
        b.lineTo(len / 2 - RUNWAY_CENTERLINE_INSET, 0)
        b.stroke()
        b.setLineDash([])
        b.fillStyle = 'rgba(244,235,216,.85)'
        const tx = sgn > 0 ? -len / 2 : len / 2 - RUNWAY_LABEL_INSET
        for (let i = 0; i < RUNWAY_THRESHOLD_BARS; i++)
          b.fillRect(
            tx + RUNWAY_BAR_X_OFFSET,
            -wid / 2 +
              RUNWAY_BAR_Y_INSET +
              (i * (wid - RUNWAY_BAR_SPAN_TRIM)) / RUNWAY_BAR_SPACING_DIVISOR,
            RUNWAY_BAR_WIDTH,
            RUNWAY_BAR_HEIGHT
          )
        b.font = '800 ' + RUNWAY_LABEL_FONT_SIZE + 'px ' + MONO
        b.textAlign = 'center'
        b.save()
        if (sgn < 0) b.rotate(Math.PI)
        b.fillText(r.label, 0, wid / 2 - RUNWAY_LABEL_OFFSET_Y)
        b.restore()
        b.restore()
      }
    }
    drawRunways()
    const drawGatesAndBorder = (): void => {
      const GATE_LINE_WIDTH = 2,
        GATE_INSET = 3,
        GATE_TRIM = 6,
        GATE_DASH_ON = 4,
        GATE_DASH_OFF = 5
      const GATE_DASH: [number, number] = [GATE_DASH_ON, GATE_DASH_OFF]
      for (const gt of W.gates) {
        const p = cellC(gt.c)
        b.strokeStyle = 'rgba(244,235,216,.5)'
        b.lineWidth = GATE_LINE_WIDTH
        b.setLineDash(GATE_DASH)
        b.strokeRect(
          p.x - C.CELL / 2 + GATE_INSET,
          p.y - C.CELL / 2 + GATE_INSET,
          C.CELL - GATE_TRIM,
          C.CELL - GATE_TRIM
        )
        b.setLineDash([])
      }
      const GRID_BORDER_WIDTH = 2.5,
        GRID_BORDER_INSET = 2,
        GRID_BORDER_EXPAND = 4,
        GRID_BORDER_RADIUS = 14,
        GRID_BORDER_DASH_ON = 10,
        GRID_BORDER_DASH_OFF = 8
      const GRID_BORDER_DASH: [number, number] = [GRID_BORDER_DASH_ON, GRID_BORDER_DASH_OFF]
      b.strokeStyle = 'rgba(244,235,216,.35)'
      b.lineWidth = GRID_BORDER_WIDTH
      b.setLineDash(GRID_BORDER_DASH)
      roundRectPath(
        b,
        gx0 - GRID_BORDER_INSET,
        gy0 - GRID_BORDER_INSET,
        gw + GRID_BORDER_EXPAND,
        gh + GRID_BORDER_EXPAND,
        GRID_BORDER_RADIUS
      )
      b.stroke()
      b.setLineDash([])
    }
    drawGatesAndBorder()
    return off
  }

  /* ---------------- frame render ---------------- */
  function drawClouds(C: typeof CONFIG, W: World): void {
    const CLOUD_CELL_INSET = 1,
      CLOUD_CELL_TRIM = 2,
      CLOUD_ALPHA = 0.95
    // Each puff: [offsetX, offsetY, radiusRatio] relative to the cloud centre/size.
    const PUFF0_OX = 0,
      PUFF0_OY = 0,
      PUFF0_RR = 0.62,
      PUFF1_OX = -0.5,
      PUFF1_OY = 0.15,
      PUFF1_RR = 0.42,
      PUFF2_OX = 0.5,
      PUFF2_OY = 0.18,
      PUFF2_RR = 0.44,
      PUFF3_OX = 0,
      PUFF3_OY = -0.38,
      PUFF3_RR = 0.4,
      PUFF4_OX = -0.28,
      PUFF4_OY = -0.22,
      PUFF4_RR = 0.34
    const CLOUD_PUFFS: [number, number, number][] = [
      [PUFF0_OX, PUFF0_OY, PUFF0_RR],
      [PUFF1_OX, PUFF1_OY, PUFF1_RR],
      [PUFF2_OX, PUFF2_OY, PUFF2_RR],
      [PUFF3_OX, PUFF3_OY, PUFF3_RR],
      [PUFF4_OX, PUFF4_OY, PUFF4_RR],
    ]
    // Storm clouds: static blobs (no bob, no lightning) for a cleaner look.
    for (const cl of W.clouds) {
      ctx.save()
      for (const c of cl.cells) {
        const p = cellC(c)
        ctx.fillStyle = 'rgba(20,30,42,.30)'
        ctx.fillRect(
          p.x - C.CELL / 2 + CLOUD_CELL_INSET,
          p.y - C.CELL / 2 + CLOUD_CELL_INSET,
          C.CELL - CLOUD_CELL_TRIM,
          C.CELL - CLOUD_CELL_TRIM
        )
      }
      const cc = cellC(cl.c),
        R = cl.r * C.CELL
      ctx.fillStyle = '#4E5D6E'
      ctx.globalAlpha = CLOUD_ALPHA
      CLOUD_PUFFS.forEach(([ox, oy, rr]) => {
        ctx.beginPath()
        ctx.arc(cc.x + ox * R, cc.y + oy * R, R * rr, 0, TAU)
        ctx.fill()
      })
      ctx.restore()
    }
  }
  function drawRadar(C: typeof CONFIG, W: World): void {
    if (W.military) {
      const RADAR_CELL_INSET = 0.5,
        RADAR_RING_WIDTH = 2.5,
        RADAR_RING_RADIUS = 11,
        RADAR_SWEEP_RATE = 2,
        RADAR_SWEEP_LENGTH = 13
      const m = W.military
      ctx.save()
      ctx.translate(
        C.X0 + (m.x0 + m.w - RADAR_CELL_INSET) * C.CELL,
        C.Y0 + (m.y0 + RADAR_CELL_INSET) * C.CELL
      )
      ctx.strokeStyle = '#FF8C8C'
      ctx.lineWidth = RADAR_RING_WIDTH
      ctx.beginPath()
      ctx.arc(0, 0, RADAR_RING_RADIUS, 0, TAU)
      ctx.stroke()
      ctx.rotate(G.clock * RADAR_SWEEP_RATE)
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(RADAR_SWEEP_LENGTH, 0)
      ctx.stroke()
      ctx.restore()
    }
  }
  function drawStars(sim: Sim | null, W: World): void {
    const STAR_HALO_ALPHA = 0.2,
      STAR_HALO_RADIUS = 20,
      STAR_SHAPE_RADIUS = 12
    W.stars.forEach((st, i) => {
      if (sim && sim['starsTaken'] && sim['starsTaken'][i]) return
      const p = cellC(st.c)
      ctx.save()
      ctx.globalAlpha = STAR_HALO_ALPHA
      ctx.beginPath()
      ctx.arc(p.x, p.y, STAR_HALO_RADIUS, 0, TAU)
      ctx.fillStyle = '#FFD45E'
      ctx.fill()
      ctx.restore()
      // Static star: no bob, no rotation.
      drawStarShape(ctx, p.x, p.y, STAR_SHAPE_RADIUS, 0, '#FFD45E')
    })
  }
  function drawGates(C: typeof CONFIG, W: World, isPlanning: boolean): void {
    const GATE_PULSE_AMP = 0.1,
      GATE_PULSE_FREQ = 7,
      GATE_BORDER_INSET = 3,
      GATE_BORDER_TRIM = 6,
      GATE_BORDER_RADIUS = 8,
      GATE_BASE_LINE_WIDTH = 3,
      GATE_CHEVRON_BASE_RATIO = 0.18,
      GATE_CHEVRON_STEP = 8,
      GATE_CHEVRON_HALF = 7,
      GATE_CHIP_RATIO = 0.42
    // Edge index (0..3) → outward normal direction. Edges: top, right, bottom, left.
    const NORMAL_NEG = -1,
      NORMAL_POS = 1,
      NORMAL_ZERO = 0
    const GATE_NORMAL_X = [NORMAL_ZERO, NORMAL_NEG, NORMAL_ZERO, NORMAL_POS],
      GATE_NORMAL_Y = [NORMAL_POS, NORMAL_ZERO, NORMAL_NEG, NORMAL_ZERO]
    W.gates.forEach((gt, gi) => {
      const owner = W.planes.find((p) => p.target.kind === 'gate' && p.target.idx === gi)
      const p = cellC(gt.c),
        col = owner ? owner.color : '#9FB1C2'
      const pulse =
        isPlanning && owner && G.selected === owner.id
          ? 1 + GATE_PULSE_AMP * Math.sin(G.clock * GATE_PULSE_FREQ)
          : 1
      ctx.save()
      ctx.strokeStyle = col
      ctx.lineWidth = GATE_BASE_LINE_WIDTH * pulse
      roundRectPath(
        ctx,
        p.x - C.CELL / 2 + GATE_BORDER_INSET,
        p.y - C.CELL / 2 + GATE_BORDER_INSET,
        C.CELL - GATE_BORDER_TRIM,
        C.CELL - GATE_BORDER_TRIM,
        GATE_BORDER_RADIUS
      )
      ctx.stroke()
      const nrm = { x: req(GATE_NORMAL_X[gt.edge]), y: req(GATE_NORMAL_Y[gt.edge]) }
      ctx.lineWidth = GATE_BASE_LINE_WIDTH
      for (let k = 0; k < 2; k++) {
        const o = C.CELL * GATE_CHEVRON_BASE_RATIO + k * GATE_CHEVRON_STEP
        ctx.beginPath()
        ctx.moveTo(
          p.x - nrm.x * o - nrm.y * GATE_CHEVRON_HALF,
          p.y - nrm.y * o - nrm.x * GATE_CHEVRON_HALF
        )
        ctx.lineTo(p.x - nrm.x * (o + GATE_CHEVRON_HALF), p.y - nrm.y * (o + GATE_CHEVRON_HALF))
        ctx.lineTo(
          p.x - nrm.x * o + nrm.y * GATE_CHEVRON_HALF,
          p.y - nrm.y * o + nrm.x * GATE_CHEVRON_HALF
        )
        ctx.stroke()
      }
      if (owner)
        symChip(
          p.x + nrm.x * C.CELL * GATE_CHIP_RATIO,
          p.y + nrm.y * C.CELL * GATE_CHIP_RATIO,
          owner,
          pulse
        )
      ctx.restore()
    })
  }
  function drawApproachMarkers(C: typeof CONFIG, W: World, isPlanning: boolean): void {
    // Group landing aircraft by their target runway. When two planes are routed
    // to the *same* runway their chevrons + chips would otherwise draw exactly on
    // top of each other (so only the last colour shows), hiding that the runway
    // is shared. Fan the markers out perpendicular to the approach so every
    // aircraft's colour is visible.
    const landByRunway = new Map<number, Plane[]>()
    for (const p of W.planes) {
      if (p.mission !== 'land') continue
      const list = landByRunway.get(p.target.idx)
      if (list) list.push(p)
      else landByRunway.set(p.target.idx, [p])
    }
    const LANE_SPREAD = 20,
      APPROACH_PULSE_AMP = 0.1,
      APPROACH_PULSE_FREQ = 7,
      APPROACH_LINE_WIDTH = 3.5,
      APPROACH_CHEVRON_STEP = 11,
      APPROACH_CHEVRON_BASE = -2,
      APPROACH_CHEVRON_HALF = 9,
      APPROACH_CHIP_RATIO = 0.45
    landByRunway.forEach((group, idx) => {
      const r = req(W.runways[idx]),
        ap = cellC(r.appr),
        th = cellC(r.thr)
      const dx = th.x - ap.x,
        dy = th.y - ap.y,
        L2 = Math.hypot(dx, dy),
        ux = dx / L2,
        uy = dy / L2
      // Perpendicular to the approach axis, used to spread shared markers apart.
      const perpX = -uy,
        perpY = ux
      const isShared = group.length > 1
      group.forEach((pl, i) => {
        const lane = isShared ? (i - (group.length - 1) / 2) * LANE_SPREAD : 0
        const ox = perpX * lane,
          oy = perpY * lane
        const pulse =
          isPlanning && G.selected === pl.id
            ? 1 + APPROACH_PULSE_AMP * Math.sin(G.clock * APPROACH_PULSE_FREQ)
            : 1
        ctx.save()
        ctx.strokeStyle = pl.color
        ctx.lineWidth = APPROACH_LINE_WIDTH * pulse
        for (let k = 0; k < 2; k++) {
          const o = k * APPROACH_CHEVRON_STEP + APPROACH_CHEVRON_BASE
          ctx.beginPath()
          ctx.moveTo(
            ap.x + ox + ux * o - uy * APPROACH_CHEVRON_HALF,
            ap.y + oy + uy * o + ux * APPROACH_CHEVRON_HALF
          )
          ctx.lineTo(
            ap.x + ox + ux * (o + APPROACH_CHEVRON_HALF),
            ap.y + oy + uy * (o + APPROACH_CHEVRON_HALF)
          )
          ctx.lineTo(
            ap.x + ox + ux * o + uy * APPROACH_CHEVRON_HALF,
            ap.y + oy + uy * o - ux * APPROACH_CHEVRON_HALF
          )
          ctx.stroke()
        }
        symChip(
          ap.x + ox - ux * C.CELL * APPROACH_CHIP_RATIO,
          ap.y + oy - uy * C.CELL * APPROACH_CHIP_RATIO,
          pl,
          pulse
        )
        ctx.restore()
      })
    })
  }
  function drawDesireLines(W: World, isPlanning: boolean): void {
    const DESIRE_ALPHA_SELECTED = 0.5,
      DESIRE_ALPHA_IDLE = 0.16,
      DESIRE_LINE_WIDTH = 2,
      DESIRE_DASH_ON = 3,
      DESIRE_DASH_OFF = 8
    const DESIRE_DASH: [number, number] = [DESIRE_DASH_ON, DESIRE_DASH_OFF]
    if (isPlanning)
      for (const pl of W.planes) {
        const sol = G.paths[pl.id]
        if (sol && sol.complete) continue
        const a = pl.mission === 'depart' ? cellC(req(W.runways[pl.rwIdx]).end) : cellC(pl.spawn)
        const bb = cellC(targetCellOf(pl, W))
        ctx.save()
        ctx.globalAlpha = G.selected === pl.id ? DESIRE_ALPHA_SELECTED : DESIRE_ALPHA_IDLE
        ctx.strokeStyle = pl.color
        ctx.lineWidth = DESIRE_LINE_WIDTH
        ctx.setLineDash(DESIRE_DASH)
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(bb.x, bb.y)
        ctx.stroke()
        ctx.restore()
      }
  }
  function drawRoutes(W: World, isPlanning: boolean): void {
    const ROUTE_ALPHA_PLAN = 0.95,
      ROUTE_ALPHA_SIM = 0.2,
      ROUTE_OUTLINE_WIDTH = 8,
      ROUTE_FILL_WIDTH = 4.5,
      ROUTE_END_LINE_WIDTH = 2.5,
      ROUTE_END_RADIUS = 13,
      ROUTE_END_PULSE_AMP = 3,
      ROUTE_END_PULSE_FREQ = 8,
      ROUTE_END_FONT_SIZE = 16,
      ROUTE_END_TEXT_OFFSET_Y = 5,
      ROUTE_END_DASH_LEN = 4
    const ROUTE_END_DASH: [number, number] = [ROUTE_END_DASH_LEN, ROUTE_END_DASH_LEN]
    for (const pl of W.planes) {
      const sol = G.paths[pl.id]
      if (!sol || sol.cells.length < 2) continue
      const pts = pathPts(sol)
      ctx.save()
      ctx.globalAlpha = isPlanning ? ROUTE_ALPHA_PLAN : ROUTE_ALPHA_SIM
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.strokeStyle = 'rgba(244,250,252,.85)'
      ctx.lineWidth = ROUTE_OUTLINE_WIDTH
      poly(pts)
      ctx.stroke()
      ctx.strokeStyle = pl.color
      ctx.lineWidth = ROUTE_FILL_WIDTH
      poly(pts)
      ctx.stroke()
      if (isPlanning && !sol.complete) {
        const e = req(pts[pts.length - 1])
        ctx.setLineDash(ROUTE_END_DASH)
        ctx.strokeStyle = '#FF5C5C'
        ctx.lineWidth = ROUTE_END_LINE_WIDTH
        ctx.beginPath()
        ctx.arc(
          e.x,
          e.y,
          ROUTE_END_RADIUS + ROUTE_END_PULSE_AMP * Math.sin(G.clock * ROUTE_END_PULSE_FREQ),
          0,
          TAU
        )
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = '#FF5C5C'
        ctx.font = '800 ' + ROUTE_END_FONT_SIZE + 'px ' + FONT
        ctx.textAlign = 'center'
        ctx.fillText('!', e.x, e.y + ROUTE_END_TEXT_OFFSET_Y)
      }
      ctx.restore()
    }
  }
  function drawPlanes(C: typeof CONFIG, W: World, sim: Sim | null, isPlanning: boolean): void {
    if (isPlanning || !sim) {
      drawParkedPlanes(C, W, isPlanning)
    } else {
      drawSimPlanes(C, sim)
    }
  }
  function drawParkedPlanes(C: typeof CONFIG, W: World, isPlanning: boolean): void {
    const PARKED_SEP_LINE_WIDTH = 2,
      PARKED_SEP_ALPHA = 0.4,
      PARKED_SELECTED_SCALE = 1.08,
      PARKED_CHIP_OFFSET_RATIO = 1.9,
      PARKED_CHIP_SELECTED_SCALE = 1.12,
      PARKED_SEP_DASH_ON = 5,
      PARKED_SEP_DASH_OFF = 7
    const PARKED_SEP_DASH: [number, number] = [PARKED_SEP_DASH_ON, PARKED_SEP_DASH_OFF]
    for (const pl of W.planes) {
      const home = planeHome(pl, W),
        sol = G.paths[pl.id]
      let ang: number
      if (sol && sol.cells.length > 1) {
        const a = cellC(req(sol.cells[0])),
          b = cellC(req(sol.cells[1]))
        ang = Math.atan2(b.y - a.y, b.x - a.x)
      } else if (pl.mission === 'depart') {
        const r = req(W.runways[pl.rwIdx])
        ang = Math.atan2(r.dir.y, r.dir.x)
      } else {
        const t = cellC(targetCellOf(pl, W))
        ang = Math.atan2(t.y - home.y, t.x - home.x)
      }
      const isSelected = G.selected === pl.id
      if (isSelected && isPlanning) {
        ctx.save()
        ctx.setLineDash(PARKED_SEP_DASH)
        ctx.strokeStyle = pl.color
        ctx.globalAlpha = PARKED_SEP_ALPHA
        ctx.lineWidth = PARKED_SEP_LINE_WIDTH
        ctx.beginPath()
        ctx.arc(home.x, home.y, CONFIG.SEP_BLOCKS * C.CELL, 0, TAU)
        ctx.stroke()
        ctx.restore()
      }
      // Static parked plane: no hover bob, no spinning prop.
      drawPlane(ctx, pl.type, home.x, home.y, ang, pl.color, {
        scale: isSelected ? PARKED_SELECTED_SCALE : 1,
      })
      symChip(
        home.x,
        home.y - pl.type.r * PARKED_CHIP_OFFSET_RATIO,
        pl,
        isSelected ? PARKED_CHIP_SELECTED_SCALE : 1
      )
    }
  }
  function drawSimPlanes(C: typeof CONFIG, sim: Sim): void {
    const SIM_SEP_ALPHA = 0.13,
      SIM_SEP_LINE_WIDTH = 2,
      SIM_SEP_DASH_ON = 4,
      SIM_SEP_DASH_OFF = 7
    const SIM_SEP_DASH: [number, number] = [SIM_SEP_DASH_ON, SIM_SEP_DASH_OFF]
    for (const p of sim.planes) {
      if (p.state !== 'flying') continue
      if (!sim.rolling(p)) {
        ctx.save()
        ctx.setLineDash(SIM_SEP_DASH)
        ctx.strokeStyle = p.color
        ctx.globalAlpha = SIM_SEP_ALPHA
        ctx.lineWidth = SIM_SEP_LINE_WIDTH
        ctx.beginPath()
        ctx.arc(p.x, p.y, CONFIG.SEP_BLOCKS * C.CELL, 0, TAU)
        ctx.stroke()
        ctx.restore()
      }
      // Static sprite: no prop spin, no take-off/landing scale pulse, no trail —
      // the plane just translates along its route.
      drawPlane(ctx, p.type, p.x, p.y, p.ang, p.color, { scale: 1 })
    }
  }
  function drawGhost(dt: number, C: typeof CONFIG, isPlanning: boolean): void {
    const ghost = G.ghost
    if (isPlanning && G.ghostOn && ghost) {
      const GHOST_FADE_DURATION = 0.8,
        GHOST_SEP_LINE_WIDTH = 3,
        GHOST_SEP_BASE_RADIUS = 10,
        GHOST_SEP_GROWTH = 46,
        GHOST_BONK_LINE_WIDTH = 4,
        GHOST_BONK_BASE_RADIUS = 8,
        GHOST_BONK_GROWTH = 36,
        GHOST_LABEL_FONT_SIZE = 14,
        GHOST_LABEL_OFFSET_Y = 20
      for (const p of ghost.planes)
        if (p.state === 'flying')
          drawPlane(ctx, p.type, p.x, p.y, p.ang, p.color, {
            ghost: true,
            noShadow: true,
            spin: ghost.t,
          })
      for (const f of G.ghostFx) {
        ctx.save()
        ctx.globalAlpha = 1 - f.t / GHOST_FADE_DURATION
        if (f.sep) {
          ctx.strokeStyle = '#FFB948'
          ctx.lineWidth = GHOST_SEP_LINE_WIDTH
          ctx.beginPath()
          ctx.arc(f.x, f.y, GHOST_SEP_BASE_RADIUS + f.t * GHOST_SEP_GROWTH, 0, TAU)
          ctx.stroke()
        } else {
          ctx.strokeStyle = '#FF5C5C'
          ctx.lineWidth = GHOST_BONK_LINE_WIDTH
          const r = GHOST_BONK_BASE_RADIUS + f.t * GHOST_BONK_GROWTH
          ctx.beginPath()
          ctx.moveTo(f.x - r, f.y - r)
          ctx.lineTo(f.x + r, f.y + r)
          ctx.moveTo(f.x + r, f.y - r)
          ctx.lineTo(f.x - r, f.y + r)
          ctx.stroke()
        }
        ctx.restore()
      }
      G.ghostFx = G.ghostFx.filter((f) => (f.t += dt) < GHOST_FADE_DURATION)
      ctx.fillStyle = 'rgba(244,235,216,.55)'
      ctx.font = '800 ' + GHOST_LABEL_FONT_SIZE + 'px ' + FONT
      ctx.textAlign = 'center'
      ctx.fillText('👻 test flight ×5', C.W / 2, C.Y0 + GHOST_LABEL_OFFSET_Y)
    }
  }
  function render(dt: number): void {
    const C = CONFIG,
      W = G.world
    if (!W || !bgCache) {
      ctx.fillStyle = '#16242F'
      ctx.fillRect(0, 0, C.W, C.H)
      return
    }
    G.clock += dt
    ctx.clearRect(0, 0, C.W, C.H)
    ctx.drawImage(bgCache, 0, 0)
    const sim = G.sim,
      isPlanning = G.phase === 'plan'
    drawClouds(C, W)
    drawRadar(C, W)
    drawStars(sim, W)
    drawGates(C, W, isPlanning)
    drawApproachMarkers(C, W, isPlanning)
    drawDesireLines(W, isPlanning)
    drawRoutes(W, isPlanning)
    drawPlanes(C, W, sim, isPlanning)
    drawGhost(dt, C, isPlanning)
    renderFx(dt)
  }
  function renderFx(dt: number): void {
    const FLOATY_FADE_START = 1.4,
      FLOATY_DEFAULT_SIZE = 19,
      FLOATY_OUTLINE_WIDTH = 4,
      FLOATY_RISE = 32,
      SEP_OUTER_LINE_WIDTH = 3.5,
      SEP_INNER_LINE_WIDTH = 2,
      SEP_BASE_RADIUS = 12,
      SEP_OUTER_GROWTH = 55,
      SEP_INNER_GROWTH = 34,
      BANNER_FADE_START = 2,
      BANNER_FADE_RATE = 1.6,
      BANNER_HALF_WIDTH = 46,
      BANNER_TOP = -21,
      BANNER_WIDTH = 92,
      BANNER_HEIGHT = 40,
      BANNER_RADIUS = 10,
      BANNER_BORDER_WIDTH = 3,
      BONK_FONT_SIZE = 23,
      BONK_TEXT_OFFSET_Y = 8,
      LABEL_BANNER_FONT_SIZE = 18,
      LABEL_BANNER_PADDING = 30,
      LABEL_BANNER_TEXT_OFFSET_Y = 7,
      PUFF_FADE_START = 0.8,
      PUFF_COUNT = 5,
      PUFF_SPREAD = 28,
      PUFF_BASE_SIZE = 9,
      PUFF_GROWTH = 7,
      BLOCK_FADE_START = 0.9,
      BLOCK_FADE_RATE = 2,
      BLOCK_LINE_WIDTH = 4,
      BLOCK_BASE_RADIUS = 11,
      BLOCK_GROWTH = 28,
      FX_LIFETIME = 1.5
    const drawBanner = (
      p: number,
      fx: number,
      fy: number,
      fill: string,
      txt: string,
      fontSize: number,
      textOffsetY: number
    ): void => {
      ctx.translate(fx, fy)
      ctx.globalAlpha = clamp(BANNER_FADE_START - p * BANNER_FADE_RATE, 0, 1)
      ctx.font = '900 ' + fontSize + 'px ' + FONT
      ctx.textAlign = 'center'
      const w = ctx.measureText(txt).width + LABEL_BANNER_PADDING
      ctx.fillStyle = fill
      roundRectPath(ctx, -w / 2, BANNER_TOP, w, BANNER_HEIGHT, BANNER_RADIUS)
      ctx.fill()
      ctx.strokeStyle = '#F4EBD8'
      ctx.lineWidth = BANNER_BORDER_WIDTH
      roundRectPath(ctx, -w / 2, BANNER_TOP, w, BANNER_HEIGHT, BANNER_RADIUS)
      ctx.stroke()
      ctx.fillStyle = '#F4EBD8'
      ctx.fillText(txt, 0, textOffsetY)
    }
    const drawFloaty = (p: number, fx: number, fy: number, f: Fx): void => {
      ctx.globalAlpha = clamp(FLOATY_FADE_START - p, 0, 1)
      ctx.font = `800 ${f.size || FLOATY_DEFAULT_SIZE}px ${FONT}`
      ctx.textAlign = 'center'
      ctx.lineWidth = FLOATY_OUTLINE_WIDTH
      ctx.strokeStyle = 'rgba(13,20,28,.8)'
      ctx.strokeText(f.txt || '', fx, fy - p * FLOATY_RISE)
      ctx.fillStyle = f.color || '#F4EBD8'
      ctx.fillText(f.txt || '', fx, fy - p * FLOATY_RISE)
    }
    const drawSep = (p: number, fx: number, fy: number): void => {
      ctx.globalAlpha = clamp(1 - p, 0, 1)
      ctx.strokeStyle = '#FFB948'
      ctx.lineWidth = SEP_OUTER_LINE_WIDTH
      ctx.beginPath()
      ctx.arc(fx, fy, SEP_BASE_RADIUS + p * SEP_OUTER_GROWTH, 0, TAU)
      ctx.stroke()
      ctx.lineWidth = SEP_INNER_LINE_WIDTH
      ctx.beginPath()
      ctx.arc(fx, fy, SEP_BASE_RADIUS + p * SEP_INNER_GROWTH, 0, TAU)
      ctx.stroke()
    }
    const drawBonk = (p: number, fx: number, fy: number): void => {
      // Just the "BONK!" text — no star burst, no spinning planes.
      ctx.translate(fx, fy)
      ctx.globalAlpha = clamp(BANNER_FADE_START - p * BANNER_FADE_RATE, 0, 1)
      ctx.fillStyle = '#FF5C5C'
      roundRectPath(ctx, -BANNER_HALF_WIDTH, BANNER_TOP, BANNER_WIDTH, BANNER_HEIGHT, BANNER_RADIUS)
      ctx.fill()
      ctx.strokeStyle = '#F4EBD8'
      ctx.lineWidth = BANNER_BORDER_WIDTH
      roundRectPath(ctx, -BANNER_HALF_WIDTH, BANNER_TOP, BANNER_WIDTH, BANNER_HEIGHT, BANNER_RADIUS)
      ctx.stroke()
      ctx.fillStyle = '#F4EBD8'
      ctx.font = '900 ' + BONK_FONT_SIZE + 'px ' + FONT
      ctx.textAlign = 'center'
      ctx.fillText('BONK!', 0, BONK_TEXT_OFFSET_Y)
    }
    const drawPuff = (p: number, fx: number, fy: number): void => {
      ctx.globalAlpha = clamp(PUFF_FADE_START - p, 0, 1)
      ctx.fillStyle = '#DCE7EE'
      for (let i = 0; i < PUFF_COUNT; i++) {
        const a = (i * TAU) / PUFF_COUNT
        ctx.beginPath()
        ctx.arc(
          fx + Math.cos(a) * p * PUFF_SPREAD,
          fy + Math.sin(a) * p * PUFF_SPREAD,
          PUFF_BASE_SIZE + p * PUFF_GROWTH,
          0,
          TAU
        )
        ctx.fill()
      }
    }
    const drawBlock = (p: number, fx: number, fy: number): void => {
      ctx.globalAlpha = clamp(BLOCK_FADE_START - p * BLOCK_FADE_RATE, 0, 1)
      ctx.strokeStyle = '#FF5C5C'
      ctx.lineWidth = BLOCK_LINE_WIDTH
      ctx.beginPath()
      ctx.arc(fx, fy, BLOCK_BASE_RADIUS + p * BLOCK_GROWTH, 0, TAU)
      ctx.stroke()
    }
    const renderOneFx = (f: Fx, p: number, fx: number, fy: number): void => {
      if (f.kind === 'floaty') {
        drawFloaty(p, fx, fy, f)
      } else if (f.kind === 'sep') {
        drawSep(p, fx, fy)
      } else if (f.kind === 'bonk') {
        drawBonk(p, fx, fy)
      } else if (f.kind === 'intercept') {
        drawBanner(
          p,
          fx,
          fy,
          '#3478E0',
          'INTERCEPTED',
          LABEL_BANNER_FONT_SIZE,
          LABEL_BANNER_TEXT_OFFSET_Y
        )
      } else if (f.kind === 'arrive') {
        drawBanner(
          p,
          fx,
          fy,
          '#33B36B',
          f.txt || 'LANDED',
          LABEL_BANNER_FONT_SIZE,
          LABEL_BANNER_TEXT_OFFSET_Y
        )
      } else if (f.kind === 'puff') {
        drawPuff(p, fx, fy)
      } else if (f.kind === 'block') {
        drawBlock(p, fx, fy)
      }
    }
    for (const f of G.fx) {
      f.t += dt
      const p = f.t
      ctx.save()
      const fx = f.x ?? 0,
        fy = f.y ?? 0
      renderOneFx(f, p, fx, fy)
      ctx.restore()
    }
    G.fx = G.fx.filter((f) => f.t < FX_LIFETIME)
  }

  /* ---------------- input ---------------- */
  function toWorld(e: PointerEvent): Vec {
    const r = canvas.getBoundingClientRect()
    return { x: (e.clientX - r.left) / VIEW.scale, y: (e.clientY - r.top) / VIEW.scale }
  }
  const clonePath = (sol: PlanePath | null | undefined): PlanePath | null =>
    sol ? { cells: sol.cells.map((c) => ({ x: c.x, y: c.y })), complete: sol.complete } : null
  function cloneSolution(s: Record<number, PlanePath>): Record<number, PlanePath> {
    const o: Record<number, PlanePath> = {}
    for (const k in s) {
      const key = Number(k)
      const cp = clonePath(s[key])
      if (cp) o[key] = cp
    }
    return o
  }
  // Nothing blocks the pen: routes may be drawn through no-fly zones and storms
  // (a plane that flies through them is intercepted / bonked in the replay).
  // Only the grid edge constrains drawing.
  const blockedCell = (c: Cell): boolean => !inGrid(c)

  function emitSubmission(): void {
    onSubmissionChange?.({ solution: cloneSolution(G.paths) })
  }
  function emitCommit(): void {
    onCommit?.({ solution: cloneSolution(G.paths) })
  }

  function onPointerDown(e: PointerEvent): void {
    Sfx.ensure()
    if (G.phase !== 'plan') return
    e.preventDefault()
    if (canvas.setPointerCapture)
      try {
        canvas.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    const p = toWorld(e),
      W = G.world
    const tryStartFromPlane = (): boolean => {
      const PLANE_TAP_PADDING = 22
      const pl = W.planes.find((o) => dist(planeHome(o, W), p) < o.type.r + PLANE_TAP_PADDING)
      if (pl) {
        G.drawing = {
          id: pl.id,
          prev: clonePath(G.paths[pl.id]),
          moved: false,
          minLen: pl.mission === 'depart' ? req(W.runways[pl.rwIdx]).cells.length : 1,
        }
        const cells =
          pl.mission === 'depart'
            ? req(W.runways[pl.rwIdx]).cells.map((c) => ({ x: c.x, y: c.y }))
            : [{ x: pl.spawn.x, y: pl.spawn.y }]
        G.paths[pl.id] = { cells, complete: false }
        G.selected = pl.id
        Sfx.honk()
        updateStatus()
        return true
      }
      return false
    }
    const tryExtendRoute = (): boolean => {
      const TAP_END_SNAP_RATIO = 0.9
      for (const o of W.planes) {
        const sol = G.paths[o.id]
        if (
          sol &&
          !sol.complete &&
          sol.cells.length > 1 &&
          dist(cellC(req(sol.cells[sol.cells.length - 1])), p) < CONFIG.CELL * TAP_END_SNAP_RATIO
        ) {
          G.drawing = {
            id: o.id,
            prev: clonePath(sol),
            moved: true,
            minLen: o.mission === 'depart' ? req(W.runways[o.rwIdx]).cells.length : 1,
          }
          G.selected = o.id
          Sfx.plop()
          return true
        }
      }
      return false
    }
    if (tryStartFromPlane()) return
    if (tryExtendRoute()) return
    G.tapCell = { c: pxCell(p), x: p.x, y: p.y }
  }
  function onPointerMove(e: PointerEvent): void {
    const drawing = G.drawing
    if (!drawing || G.phase !== 'plan') return
    e.preventDefault()
    const C = CONFIG,
      sol = req(G.paths[drawing.id]),
      cells = sol.cells
    const EDGE_INSET = 1,
      DRAW_STEP_GUARD = 50,
      BLOCK_FLASH_COOLDOWN = 0.15,
      BLOCK_VIBRATE_MS = 20,
      MAX_PATH_CELLS = 120
    const p = toWorld(e)
    p.x = clamp(p.x, C.X0 + EDGE_INSET, C.X0 + C.COLS * C.CELL - EDGE_INSET)
    p.y = clamp(p.y, C.Y0 + EDGE_INSET, C.Y0 + C.ROWS * C.CELL - EDGE_INSET)
    const cur = pxCell(p)
    const resolveDiagonal = (last: Cell, dx: number, dy: number): Cell => {
      let next = { x: last.x + dx, y: last.y + dy }
      if (
        dx &&
        dy &&
        (blockedCell({ x: last.x + dx, y: last.y }) || blockedCell({ x: last.x, y: last.y + dy }))
      ) {
        next =
          Math.abs(cur.x - last.x) >= Math.abs(cur.y - last.y)
            ? { x: last.x + dx, y: last.y }
            : { x: last.x, y: last.y + dy }
      }
      return next
    }
    const altAround = (last: Cell, dx: number, dy: number): Cell | null => {
      let alt: Cell | null = null
      if (dx && dy) {
        const c1 = { x: last.x + dx, y: last.y },
          c2 = { x: last.x, y: last.y + dy }
        if (!blockedCell(c1)) alt = c1
        else if (!blockedCell(c2)) alt = c2
      }
      return alt
    }
    const flashBlocked = (next: Cell): void => {
      if (G.clock - G.blockFlashAt > BLOCK_FLASH_COOLDOWN) {
        const bp = cellC(next)
        addFx('block', { x: bp.x, y: bp.y })
        Sfx.buzz()
        vibrate(BLOCK_VIBRATE_MS)
        G.blockFlashAt = G.clock
      }
    }
    // One drawing step: returns 'break' to stop, 'continue' to retry, 'step' when
    // it advanced the route by one cell (which is also when it must stop).
    const stepDraw = (): 'break' | 'continue' | 'step' => {
      const last = req(cells[cells.length - 1])
      if (
        cells.length > drawing.minLen &&
        cells.length > 1 &&
        sameCell(cur, req(cells[cells.length - 2]))
      ) {
        cells.pop()
        drawing.moved = true
        return 'continue'
      }
      const dx = Math.sign(cur.x - last.x),
        dy = Math.sign(cur.y - last.y)
      let next = resolveDiagonal(last, dx, dy)
      if (blockedCell(next)) {
        const alt = altAround(last, dx, dy)
        if (!alt) {
          flashBlocked(next)
          return 'break'
        }
        next = alt
      }
      if (cells.length >= MAX_PATH_CELLS) return 'break'
      cells.push(next)
      drawing.moved = true
      return 'step'
    }
    let guard = 0
    while (!sameCell(cur, req(cells[cells.length - 1])) && guard++ < DRAW_STEP_GUARD) {
      const r = stepDraw()
      if (r === 'break') break
    }
  }
  function finishStroke(): void {
    const d = G.drawing
    if (!d) return
    G.drawing = null
    const W = G.world,
      pl = req(W.planes[d.id]),
      sol = req(G.paths[d.id])
    if (!d.moved) {
      if (d.prev) G.paths[d.id] = d.prev
      else delete G.paths[d.id]
      updateStatus()
      emitSubmission()
      return
    }
    const ROUTED_TEXT_OFFSET_Y = 16,
      ROUTED_TEXT_SIZE = 16,
      ROUTED_VIBRATE_MS = 12
    const tc = targetCellOf(pl, W),
      last = req(sol.cells[sol.cells.length - 1])
    const ch = Math.max(Math.abs(last.x - tc.x), Math.abs(last.y - tc.y))
    if (ch <= CONFIG.SNAP_ADJ) {
      if (ch > 0) sol.cells.push({ x: tc.x, y: tc.y })
      sol.complete = true
      Sfx.snapOk()
      const tp = cellC(tc)
      addFx('floaty', {
        x: tp.x,
        y: tp.y - ROUTED_TEXT_OFFSET_Y,
        txt: 'ROUTED ✓',
        color: pl.color,
        size: ROUTED_TEXT_SIZE,
      })
      vibrate(ROUTED_VIBRATE_MS)
    } else sol.complete = false
    G.undoStack.push({ id: d.id, prev: d.prev })
    if (G.ghostOn) rebuildGhost()
    updateStatus()
    emitSubmission()
  }
  function onPointerUp(e: PointerEvent): void {
    if (G.phase !== 'plan') return
    if (G.drawing) {
      finishStroke()
      return
    }
    if (G.tapCell) {
      const TAP_DESELECT_RADIUS = 14
      const p = toWorld(e),
        tc = G.tapCell
      G.tapCell = null
      if (dist(p, tc) < TAP_DESELECT_RADIUS) G.selected = null
    }
  }
  function onPointerCancel(): void {
    if (G.phase === 'plan') {
      if (G.drawing) finishStroke()
      G.tapCell = null
    }
  }

  /* ---------------- flight strips + status ---------------- */
  function updateStatus(): void {
    const W = G.world
    if (!W) return
    const n = W.planes.length
    const c = W.planes.filter((p) => {
      const sol = G.paths[p.id]
      return sol && sol.complete
    }).length
    const status = q('.ba-status')
    if (G.phase === 'plan' && status) status.textContent = c + '/' + n
    const h = q('.ba-hint')
    if (!h) return
    const hasAnyInc = W.planes.some((p) => {
      const sol = G.paths[p.id]
      return sol && !sol.complete && sol.cells.length > 1
    })
    const hintText = (): string => {
      if (c === 0 && !hasAnyInc)
        return 'Drag a route from an aircraft to its target, square by square'
      else if (hasAnyInc) return 'Unfinished route (!) — keep dragging from its end, or redraw it'
      else if (c < n)
        return (
          n - c + (n - c === 1 ? ' aircraft still needs a route' : ' aircraft still need routes')
        )
      else return 'All routed — EXECUTE now: every spare second is +1 bonus'
    }
    h.textContent = hintText()
  }

  /* ---------------- ghost test + lock-in ---------------- */
  function rebuildGhost(): void {
    const hasAny = Object.values(G.paths).some((s) => s && s.cells.length > 1)
    if (!hasAny) {
      G.ghost = null
      return
    }
    G.ghost = new Sim(G.world, cloneSolution(G.paths))
    G.ghostAcc = 0
    G.ghostWait = 0
    G.ghostFx = []
  }
  // Lock the plan and hand it to the platform, but do NOT start the replay yet.
  // Pressing TAKE OFF (or the planning timer running out) must not animate this
  // player's flight early — the watch replay is started for everyone at once
  // when the server enters the reveal phase (see setPhase → startReplay).
  function commitPlan(): void {
    if (G.phase !== 'plan') return
    G.drawing = null
    G.tapCell = null
    G.ghostOn = false
    G.ghost = null
    G.phase = 'locked'
    const botbar = q('.ba-botbar')
    if (botbar) botbar.hidden = true
    const hint = q('.ba-hint')
    if (hint) hint.hidden = true
    const banner = q('.ba-banner')
    if (banner) {
      banner.textContent = '✈ Plan locked — waiting for takeoff…'
      banner.hidden = false
    }
    emitSubmission()
    emitCommit()
    Sfx.plop()
  }

  // Start the synchronised flight replay. Triggered by the reveal phase so every
  // player watches their planes move at the same moment. Commits first if the
  // plan was never locked (e.g. reveal arrived mid-planning).
  function startReplay(): void {
    if (G.phase === 'sim' || G.phase === 'done') return
    if (G.phase === 'plan') {
      G.drawing = null
      G.tapCell = null
      G.ghostOn = false
      G.ghost = null
      emitSubmission()
      emitCommit()
    }
    const solution = cloneSolution(G.paths)
    G.sim = new Sim(G.world, solution)
    G.phase = 'sim'
    G.acc = 0
    // Scale playback so the watch always finishes within the reveal window,
    // regardless of route length: probe the sim's full duration, then pick a
    // speed that completes it in ~TARGET_WATCH_SECONDS of real time.
    const probe = new Sim(G.world, solution)
    const PROBE_STEP_GUARD = 10000
    let guard = 0
    while (!probe.finished() && guard++ < PROBE_STEP_GUARD) probe.step(CONFIG.SIM_DT)
    const TARGET_WATCH_SECONDS = 5
    const MIN_SIM_SPEED = 1.5,
      MAX_SIM_SPEED = 10
    G.simSpeed = clamp(probe.t / TARGET_WATCH_SECONDS, MIN_SIM_SPEED, MAX_SIM_SPEED)
    G.runningScore = 0
    G.endHandled = false
    G.fx = []
    const botbar = q('.ba-botbar')
    if (botbar) botbar.hidden = true
    const hint = q('.ba-hint')
    if (hint) hint.hidden = true
    // No HUD during the watch — the score is shown only at the end (platform).
    const topbar = q('.ba-topbar')
    if (topbar) topbar.hidden = true
    const banner = q('.ba-banner')
    if (banner) banner.hidden = true
    Sfx.plop()
  }

  /* ---------------- sim events ---------------- */
  function handleEvent(ev: SimEvent): void {
    const BONK_VIBRATE_MS = 80,
      SEP_VIBRATE_MS = 40
    if (ev.type === 'done') {
      // Plane vanishes on arrival, leaving a green banner: "LANDED" on a runway,
      // "ROUTED" when handed off to a gate (transit/departure).
      G.runningScore += CONFIG.PTS_DONE
      Sfx.tada()
      const p = req(ev.p)
      addFx('arrive', { x: p.x, y: p.y, txt: ev.kind === 'runway' ? 'LANDED' : 'ROUTED' })
    } else if (ev.type === 'lost') {
      Sfx.lost()
      const p = req(ev.p)
      addFx('puff', { x: p.x, y: p.y })
    } else if (ev.type === 'bonk') {
      // No-fly zone → blue "INTERCEPTED" banner; storm/collision → red "BONK".
      Sfx.bonk()
      vibrate(BONK_VIBRATE_MS)
      addFx(ev.intercept ? 'intercept' : 'bonk', { x: req(ev.x), y: req(ev.y) })
    } else if (ev.type === 'sep') {
      G.runningScore -= CONFIG.SEP_PENALTY
      Sfx.alert()
      vibrate(SEP_VIBRATE_MS)
      addFx('sep', { x: req(ev.x), y: req(ev.y) })
    } else if (ev.type === 'star') {
      G.runningScore += CONFIG.PTS_STAR
      Sfx.star()
    }
  }

  /* ---------------- frame loop ---------------- */
  const MAX_FRAME_DT = 0.05,
    MS_PER_SECOND = 1000,
    SECONDS_PER_MINUTE = 60,
    TIMER_PAD_LENGTH = 2,
    GHOST_REPLAY_GAP = 0.7,
    GHOST_PLAYBACK_SPEED = 5
  function stepGhost(dt: number): void {
    const ghost = G.ghost
    if (G.ghostOn && ghost) {
      if (ghost.finished()) {
        G.ghostWait += dt
        if (G.ghostWait > GHOST_REPLAY_GAP) rebuildGhost()
      } else {
        advanceGhostPlayback(dt, ghost)
      }
    }
  }
  function advanceGhostPlayback(dt: number, ghost: NonNullable<typeof G.ghost>): void {
    G.ghostAcc += dt * GHOST_PLAYBACK_SPEED
    while (G.ghostAcc >= CONFIG.SIM_DT) {
      G.ghostAcc -= CONFIG.SIM_DT
      for (const ev of ghost.step(CONFIG.SIM_DT)) {
        if (ev.type === 'bonk') G.ghostFx.push({ x: ev.x ?? 0, y: ev.y ?? 0, t: 0 })
        else if (ev.type === 'sep') G.ghostFx.push({ x: ev.x ?? 0, y: ev.y ?? 0, t: 0, sep: true })
      }
    }
  }
  function updatePlanPhase(dt: number): void {
    if (!isReadOnly) {
      G.planLeft = Math.max(0, G.planLeft - dt)
      const s = Math.ceil(G.planLeft),
        t = q('.ba-timer')
      if (t) {
        t.textContent =
          Math.floor(s / SECONDS_PER_MINUTE) +
          ':' +
          String(s % SECONDS_PER_MINUTE).padStart(TIMER_PAD_LENGTH, '0')
        if (G.planLeft <= LOW_TIME) t.classList.add('low')
      }
      if (s < G.lastWhole) {
        G.lastWhole = s
        if (s <= LOW_TIME && s > 0) Sfx.tick()
      }
      stepGhost(dt)
      if (G.planLeft <= 0) commitPlan()
    }
  }
  function updateSimPhase(dt: number): void {
    G.acc += dt * G.simSpeed
    const sim = G.sim
    if (sim) {
      while (G.acc >= CONFIG.SIM_DT && !sim.finished()) {
        G.acc -= CONFIG.SIM_DT
        for (const ev of sim.step(CONFIG.SIM_DT)) handleEvent(ev)
      }
      if (sim.finished() && !G.endHandled) {
        G.endHandled = true
        G.phase = 'done'
        onReplayComplete?.()
      }
    }
  }
  function loop(now: number): void {
    if (isDestroyed) return
    const dt = Math.min(MAX_FRAME_DT, (now - lastT) / MS_PER_SECOND)
    lastT = now
    if (G.phase === 'plan') {
      updatePlanPhase(dt)
    } else if (G.phase === 'sim') {
      updateSimPhase(dt)
    }
    render(dt)
    rafId = requestAnimationFrame(loop)
  }

  /* ---------------- layout ---------------- */
  function resize(): void {
    const C = CONFIG,
      dpr = Math.min(window.devicePixelRatio || 1, 2)
    const cw = root.clientWidth || window.innerWidth,
      chh = root.clientHeight || window.innerHeight
    const s = Math.min(cw / C.W, chh / C.H)
    VIEW.scale = s
    canvas.style.width = Math.round(C.W * s) + 'px'
    canvas.style.height = Math.round(C.H * s) + 'px'
    canvas.width = Math.round(C.W * s * dpr)
    canvas.height = Math.round(C.H * s * dpr)
    ctx.setTransform(s * dpr, 0, 0, s * dpr, 0, 0)
    const stage = q('.ba-stage')
    if (stage) {
      stage.style.width = canvas.style.width
      stage.style.height = canvas.style.height
    }
    const rotate = q('.ba-rotate')
    if (rotate) rotate.hidden = cw >= chh
  }

  /* ---------------- wiring ---------------- */
  const onResize = (): void => resize()
  const preventTouch = (e: TouchEvent): void => {
    if (e.target === canvas) e.preventDefault()
  }

  function init(): void {
    bgCache = buildBg(world)
    resize()
    const topbar = q('.ba-topbar')
    if (topbar) topbar.hidden = false
    const botbar = q('.ba-botbar')
    const hint = q('.ba-hint')
    const timer = q('.ba-timer')
    if (timer) timer.textContent = '0:' + String(CONFIG.PLAN_SECONDS).padStart(2, '0')
    const setupInteractive = (): void => {
      if (botbar) botbar.hidden = false
      if (hint) hint.hidden = false
      updateStatus()
      const undo = q('.ba-undo')
      const test = q('.ba-test')
      const lock = q('.ba-lock')
      if (undo)
        undo.onclick = (): void => {
          if (G.phase !== 'plan') return
          const u = G.undoStack.pop()
          if (!u) {
            toast('Nothing to undo')
            return
          }
          if (u.prev) G.paths[u.id] = u.prev
          else delete G.paths[u.id]
          if (G.ghostOn) rebuildGhost()
          Sfx.plop()
          updateStatus()
          emitSubmission()
        }
      if (test)
        test.onclick = (): void => {
          if (G.phase !== 'plan') return
          if (!G.ghostOn) {
            if (!Object.values(G.paths).some((s) => s && s.cells.length > 1)) {
              toast('Draw a route first, controller ✏️')
              return
            }
            G.ghostOn = true
            rebuildGhost()
            test.textContent = '👻 Test ✓'
          } else {
            G.ghostOn = false
            G.ghost = null
            test.textContent = '👻 Test'
          }
        }
      if (lock) lock.onclick = (): void => commitPlan()
      canvas.addEventListener('pointerdown', onPointerDown)
      canvas.addEventListener('pointermove', onPointerMove)
      canvas.addEventListener('pointerup', onPointerUp)
      canvas.addEventListener('pointercancel', onPointerCancel)
      document.addEventListener('touchmove', preventTouch, { passive: false })
      toast(world.planes.length + ' aircraft on frequency — 30 seconds, go!')
    }
    if (isReadOnly) {
      if (botbar) botbar.hidden = true
      if (hint) hint.hidden = true
    } else {
      setupInteractive()
    }
    window.addEventListener('resize', onResize)
    lastT = performance.now()
    rafId = requestAnimationFrame(loop)
  }

  init()

  return {
    setPhase(phase: 'playing' | 'reveal'): void {
      // The reveal phase is broadcast to every player at once, so starting the
      // replay here keeps the flight animation in sync across all phones.
      if (phase === 'reveal') startReplay()
    },
    destroy(): void {
      isDestroyed = true
      cancelAnimationFrame(rafId)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerCancel)
      document.removeEventListener('touchmove', preventTouch)
      window.removeEventListener('resize', onResize)
    },
  }
}
