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

type DrawOpts = {
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

/* eslint-disable */
export function createBonkAirRuntime(opts: BonkAirRuntimeOptions): BonkAirRuntime {
  const { root, canvas, puzzle, readOnly, onSubmissionChange, onCommit, onReplayComplete } = opts
  const ctx = canvas.getContext('2d')!
  const q = <T extends HTMLElement>(sel: string): T | null => root.querySelector(sel) as T | null

  /* ---------------- audio (disabled for now: all no-ops) ---------------- */
  const Sfx = {
    ensure(): void {},
    honk(): void {},
    plop(): void {},
    snapOk(): void {},
    bonk(): void {},
    tada(): void {},
    tick(): void {},
    alert(): void {},
    star(): void {},
    lost(): void {},
    buzz(): void {},
  }

  /* ---------------- state ---------------- */
  const world: World = generate(hashSeed(puzzle.seed), puzzle.diff)
  const G: any = {
    phase: 'plan',
    world,
    paths: {} as Record<number, PlanePath>,
    undoStack: [] as { id: number; prev: PlanePath | null }[],
    drawing: null as any,
    selected: null as number | null,
    tapCell: null as any,
    planLeft: CONFIG.PLAN_SECONDS,
    clock: 0,
    sim: null as Sim | null,
    acc: 0,
    simSpeed: 1,
    ghost: null as Sim | null,
    ghostOn: false,
    ghostAcc: 0,
    ghostWait: 0,
    fx: [] as Fx[],
    ghostFx: [] as { x: number; y: number; t: number; sep?: boolean }[],
    runningScore: 0,
    endHandled: false,
    blockFlashAt: 0,
    lastWhole: CONFIG.PLAN_SECONDS + 1,
  }
  const VIEW = { scale: 1 }
  let bgCache: HTMLCanvasElement | null = null
  let rafId = 0
  let lastT = performance.now()
  let destroyed = false

  /* ---------------- helpers ---------------- */
  const vibrate = (ms: number): void => {
    if (navigator.vibrate) navigator.vibrate(ms)
  }
  function toast(msg: string, ms = 1900): void {
    const t = q('.ba-toast')
    if (!t) return
    t.textContent = msg
    t.classList.add('show')
    const anyT = t as any
    clearTimeout(anyT._h)
    anyT._h = setTimeout(() => t.classList.remove('show'), ms)
  }
  const addFx = (kind: string, props: Partial<Fx>): void => {
    G.fx.push({ kind, t: 0, ...props })
  }
  const targetCellOf = (pl: Plane, W: World): Cell =>
    pl.mission === 'land' ? W.runways[pl.target.idx]!.thr : W.gates[pl.target.idx]!.c
  const planeHome = (pl: Plane, W: World): Vec =>
    pl.mission === 'depart' ? cellC(W.runways[pl.rwIdx]!.thr) : cellC(pl.spawn)
  const pathPts = (sol: PlanePath): Vec[] => sol.cells.map(cellC)
  function poly(pts: Vec[]): void {
    ctx.beginPath()
    ctx.moveTo(pts[0]!.x, pts[0]!.y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y)
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
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(scale, scale)
    ctx.fillStyle = pl.color
    roundRectPath(ctx, -11, -11, 22, 22, 7)
    ctx.fill()
    ctx.strokeStyle = 'rgba(16,24,32,.55)'
    ctx.lineWidth = 2
    roundRectPath(ctx, -11, -11, 22, 22, 7)
    ctx.stroke()
    ctx.fillStyle = '#101820'
    ctx.font = '800 13px ' + FONT
    ctx.textAlign = 'center'
    ctx.fillText(pl.sym, 0, 4.5)
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
    const s = o.scale ?? 1,
      r = type.r
    if (!o.noShadow) {
      c.save()
      c.translate(x + 5, y + 7)
      c.rotate(ang)
      c.scale(s, s)
      c.fillStyle = 'rgba(8,14,20,.25)'
      c.beginPath()
      c.ellipse(0, 0, r * 1.7, r * 1.05, 0, 0, TAU)
      c.fill()
      c.restore()
    }
    c.save()
    c.translate(x, y)
    c.rotate(ang)
    c.scale(s, s)
    if (o.ghost) c.globalAlpha = 0.45
    if (o.dizzy) c.rotate(Math.sin(o.dizzy * 14) * 0.6)
    const bodyW = type.key === 'a380' ? r * 1.4 : r * 1.02,
      L = r * 3.1
    const span = type.key === 'a380' ? r * 3.5 : type.key === 'cessna' ? r * 3.0 : r * 2.8
    c.lineWidth = 2
    c.strokeStyle = 'rgba(10,18,26,.5)'
    c.fillStyle = color
    c.beginPath() // wings (swept)
    c.moveTo(r * 0.45, -span / 2)
    c.lineTo(r * 1.0, -bodyW * 0.4)
    c.lineTo(-r * 0.5, -bodyW * 0.4)
    c.lineTo(-r * 0.25, -span / 2)
    c.closePath()
    c.fill()
    c.stroke()
    c.beginPath()
    c.moveTo(r * 0.45, span / 2)
    c.lineTo(r * 1.0, bodyW * 0.4)
    c.lineTo(-r * 0.5, bodyW * 0.4)
    c.lineTo(-r * 0.25, span / 2)
    c.closePath()
    c.fill()
    c.stroke()
    c.beginPath() // tailplane
    c.moveTo(-L / 2 + r * 0.1, -r * 1.0)
    c.lineTo(-L / 2 + r * 0.8, -bodyW * 0.3)
    c.lineTo(-L / 2 + r * 0.8, bodyW * 0.3)
    c.lineTo(-L / 2 + r * 0.1, r * 1.0)
    c.closePath()
    c.fill()
    c.stroke()
    c.fillStyle = '#EDF2F6'
    const nac = (wx: number, wy: number): void => {
      roundRectPath(c, wx - r * 0.32, wy - r * 0.18, r * 0.64, r * 0.36, r * 0.16)
      c.fill()
      c.stroke()
    }
    if (type.key === 'b737') {
      nac(r * 0.38, -span * 0.26)
      nac(r * 0.38, span * 0.26)
    }
    if (type.key === 'a380') {
      nac(r * 0.42, -span * 0.32)
      nac(r * 0.22, -span * 0.17)
      nac(r * 0.22, span * 0.17)
      nac(r * 0.42, span * 0.32)
    }
    if (type.key === 'jet') {
      nac(-L / 2 + r * 0.9, -bodyW * 0.72)
      nac(-L / 2 + r * 0.9, bodyW * 0.72)
    }
    c.fillStyle = '#EDF2F6' // fuselage
    roundRectPath(c, -L / 2, -bodyW / 2, L, bodyW, bodyW / 2)
    c.fill()
    c.stroke()
    c.fillStyle = color // nose + stripe
    c.beginPath()
    c.arc(L / 2 - bodyW / 2, 0, bodyW / 2, -Math.PI / 2, Math.PI / 2)
    c.fill()
    c.fillRect(-L / 2 + bodyW * 0.4, -bodyW * 0.5, L * 0.16, bodyW)
    c.fillStyle = '#22313F' // windscreen
    roundRectPath(c, L / 2 - bodyW * 1.15, -bodyW * 0.3, bodyW * 0.55, bodyW * 0.6, bodyW * 0.2)
    c.fill()
    if (type.key === 'cessna') {
      c.strokeStyle = 'rgba(20,30,40,.65)'
      c.lineWidth = 2.2
      const a = (o.spin ?? 0) * 22
      c.beginPath()
      c.moveTo(L / 2 + Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85)
      c.lineTo(L / 2 - Math.cos(a) * r * 0.85, -Math.sin(a) * r * 0.85)
      c.stroke()
    }
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
    c.save()
    c.translate(x, y)
    c.rotate(rot)
    c.beginPath()
    for (let i = 0; i < 10; i++) {
      const rr2 = i % 2 ? R * 0.45 : R,
        a = (i * Math.PI) / 5 - Math.PI / 2
      i
        ? c.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2)
        : c.moveTo(Math.cos(a) * rr2, Math.sin(a) * rr2)
    }
    c.closePath()
    c.fillStyle = fill
    c.fill()
    c.strokeStyle = 'rgba(10,18,26,.4)'
    c.lineWidth = 2
    c.stroke()
    c.restore()
  }
  /* ---------------- background cache ---------------- */
  function buildBg(W: World): HTMLCanvasElement {
    const C = CONFIG,
      off = document.createElement('canvas')
    off.width = C.W
    off.height = C.H
    const b = off.getContext('2d')!
    const gx0 = C.X0,
      gy0 = C.Y0,
      gw = C.COLS * C.CELL,
      gh = C.ROWS * C.CELL
    b.fillStyle = '#101820'
    b.fillRect(0, 0, C.W, C.H)
    const g = b.createLinearGradient(0, gy0, 0, gy0 + gh)
    g.addColorStop(0, '#3A7E92')
    g.addColorStop(1, '#2C6376')
    b.fillStyle = g
    b.fillRect(gx0, gy0, gw, gh)
    const rr = new Rng(W.seed * 13 + 7)
    for (const isl of W.islands) {
      const blob = (rad: number, fill: string): void => {
        b.beginPath()
        for (let a = 0; a <= TAU + 0.01; a += TAU / 22) {
          const w = 1 + 0.11 * Math.sin(a * 3 + isl.seed) + 0.06 * Math.sin(a * 5 + isl.seed * 2)
          const px = isl.x + Math.cos(a) * rad * w,
            py = isl.y + Math.sin(a) * rad * w * 0.85
          a === 0 ? b.moveTo(px, py) : b.lineTo(px, py)
        }
        b.closePath()
        b.fillStyle = fill
        b.fill()
      }
      b.save()
      b.beginPath()
      b.rect(gx0, gy0, gw, gh)
      b.clip()
      blob(isl.r * 1.12, '#E4D2A1')
      blob(isl.r, '#7FB06B')
      b.fillStyle = '#6B9A59'
      for (let t = 0; t < isl.r / 20; t++) {
        const a = rr.range(0, TAU),
          d = rr.range(0.2, 0.75) * isl.r
        b.beginPath()
        b.arc(isl.x + Math.cos(a) * d, isl.y + Math.sin(a) * d * 0.85, rr.range(3, 7), 0, TAU)
        b.fill()
      }
      b.restore()
    }
    // grid + coordinates
    b.strokeStyle = 'rgba(235,248,252,0.10)'
    for (let i = 0; i <= C.COLS; i++) {
      b.lineWidth = i % 4 === 0 ? 1.6 : 0.8
      b.beginPath()
      b.moveTo(gx0 + i * C.CELL, gy0)
      b.lineTo(gx0 + i * C.CELL, gy0 + gh)
      b.stroke()
    }
    for (let j = 0; j <= C.ROWS; j++) {
      b.lineWidth = j % 4 === 0 ? 1.6 : 0.8
      b.beginPath()
      b.moveTo(gx0, gy0 + j * C.CELL)
      b.lineTo(gx0 + gw, gy0 + j * C.CELL)
      b.stroke()
    }
    b.fillStyle = 'rgba(235,248,252,0.30)'
    b.font = '700 10px ' + MONO
    b.textAlign = 'center'
    for (let i = 0; i < C.COLS; i++)
      b.fillText(String.fromCharCode(65 + i), gx0 + (i + 0.5) * C.CELL, gy0 - 5)
    b.textAlign = 'right'
    for (let j = 0; j < C.ROWS; j++)
      b.fillText(String(j + 1), gx0 - 5, gy0 + (j + 0.5) * C.CELL + 3)
    b.textAlign = 'left'
    if (W.military) {
      const m = W.military
      const x = gx0 + m.x0 * C.CELL,
        y = gy0 + m.y0 * C.CELL,
        w = m.w * C.CELL,
        h = m.h * C.CELL
      b.fillStyle = '#55606C'
      roundRectPath(b, x + 4, y + 4, w - 8, h - 8, 10)
      b.fill()
      b.save()
      b.beginPath()
      roundRectPath(b, x + 4, y + 4, w - 8, h - 8, 10)
      b.clip()
      b.strokeStyle = 'rgba(255,92,92,.5)'
      b.lineWidth = 7
      for (let k = -h; k < w + h; k += 24) {
        b.beginPath()
        b.moveTo(x + k, y)
        b.lineTo(x + k + h, y + h)
        b.stroke()
      }
      b.restore()
      b.fillStyle = '#39424E'
      roundRectPath(b, x + 10, y + 10, w - 20, h - 20, 8)
      b.fill()
      b.fillStyle = '#FF8C8C'
      b.font = '800 13px ' + MONO
      b.textAlign = 'center'
      b.fillText('NO FLY ZONE', x + w / 2, y + h / 2 + 4)
    }
    for (const r of W.runways) {
      const a = cellC(r.thr),
        e = cellC(r.end),
        horiz = r.dir.y === 0
      const len = dist(a, e) + C.CELL * 0.9,
        wid = C.CELL * 0.78
      b.save()
      b.translate((a.x + e.x) / 2, (a.y + e.y) / 2)
      if (!horiz) b.rotate(Math.PI / 2)
      const sgn = horiz ? r.dir.x : r.dir.y
      b.fillStyle = '#39424E'
      roundRectPath(b, -len / 2, -wid / 2, len, wid, 8)
      b.fill()
      b.strokeStyle = 'rgba(244,235,216,.8)'
      b.lineWidth = 3
      b.setLineDash([14, 12])
      b.beginPath()
      b.moveTo(-len / 2 + 16, 0)
      b.lineTo(len / 2 - 16, 0)
      b.stroke()
      b.setLineDash([])
      b.fillStyle = 'rgba(244,235,216,.85)'
      const tx = sgn > 0 ? -len / 2 : len / 2 - 12
      for (let i = 0; i < 4; i++) b.fillRect(tx + 6, -wid / 2 + 5 + (i * (wid - 10)) / 3.4, 11, 4)
      b.font = '800 12px ' + MONO
      b.textAlign = 'center'
      b.save()
      if (sgn < 0) b.rotate(Math.PI)
      b.fillText(r.label, 0, wid / 2 - 8)
      b.restore()
      b.restore()
    }
    for (const gt of W.gates) {
      const p = cellC(gt.c)
      b.strokeStyle = 'rgba(244,235,216,.5)'
      b.lineWidth = 2
      b.setLineDash([4, 5])
      b.strokeRect(p.x - C.CELL / 2 + 3, p.y - C.CELL / 2 + 3, C.CELL - 6, C.CELL - 6)
      b.setLineDash([])
    }
    b.strokeStyle = 'rgba(244,235,216,.35)'
    b.lineWidth = 2.5
    b.setLineDash([10, 8])
    roundRectPath(b, gx0 - 2, gy0 - 2, gw + 4, gh + 4, 14)
    b.stroke()
    b.setLineDash([])
    return off
  }

  /* ---------------- frame render ---------------- */
  function render(dt: number): void {
    const C = CONFIG,
      W = G.world as World
    if (!W || !bgCache) {
      ctx.fillStyle = '#16242F'
      ctx.fillRect(0, 0, C.W, C.H)
      return
    }
    G.clock += dt
    ctx.clearRect(0, 0, C.W, C.H)
    ctx.drawImage(bgCache, 0, 0)
    const sim = G.sim as Sim | null,
      planning = G.phase === 'plan'
    // Storm clouds: static blobs (no bob, no lightning) for a cleaner look.
    for (const cl of W.clouds) {
      ctx.save()
      for (const c of cl.cells) {
        const p = cellC(c)
        ctx.fillStyle = 'rgba(20,30,42,.30)'
        ctx.fillRect(p.x - C.CELL / 2 + 1, p.y - C.CELL / 2 + 1, C.CELL - 2, C.CELL - 2)
      }
      const cc = cellC(cl.c),
        R = cl.r * C.CELL
      ctx.fillStyle = '#4E5D6E'
      ctx.globalAlpha = 0.95
      ;(
        [
          [0, 0, 0.62],
          [-0.5, 0.15, 0.42],
          [0.5, 0.18, 0.44],
          [0, -0.38, 0.4],
          [-0.28, -0.22, 0.34],
        ] as [number, number, number][]
      ).forEach(([ox, oy, rr]) => {
        ctx.beginPath()
        ctx.arc(cc.x + ox * R, cc.y + oy * R, R * rr, 0, TAU)
        ctx.fill()
      })
      ctx.restore()
    }
    if (W.military) {
      const m = W.military
      ctx.save()
      ctx.translate(C.X0 + (m.x0 + m.w - 0.5) * C.CELL, C.Y0 + (m.y0 + 0.5) * C.CELL)
      ctx.strokeStyle = '#FF8C8C'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.arc(0, 0, 11, 0, TAU)
      ctx.stroke()
      ctx.rotate(G.clock * 2)
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(13, 0)
      ctx.stroke()
      ctx.restore()
    }
    W.stars.forEach((st, i) => {
      if (sim && sim['starsTaken'] && (sim as any).starsTaken[i]) return
      const p = cellC(st.c)
      ctx.save()
      ctx.globalAlpha = 0.2
      ctx.beginPath()
      ctx.arc(p.x, p.y, 20, 0, TAU)
      ctx.fillStyle = '#FFD45E'
      ctx.fill()
      ctx.restore()
      // Static star: no bob, no rotation.
      drawStarShape(ctx, p.x, p.y, 12, 0, '#FFD45E')
    })
    W.gates.forEach((gt, gi) => {
      const owner = W.planes.find((p) => p.target.kind === 'gate' && p.target.idx === gi)
      const p = cellC(gt.c),
        col = owner ? owner.color : '#9FB1C2'
      const pulse =
        planning && owner && G.selected === owner.id ? 1 + 0.1 * Math.sin(G.clock * 7) : 1
      ctx.save()
      ctx.strokeStyle = col
      ctx.lineWidth = 3 * pulse
      roundRectPath(ctx, p.x - C.CELL / 2 + 3, p.y - C.CELL / 2 + 3, C.CELL - 6, C.CELL - 6, 8)
      ctx.stroke()
      const nrm = { x: [0, -1, 0, 1][gt.edge]!, y: [1, 0, -1, 0][gt.edge]! }
      ctx.lineWidth = 3
      for (let k = 0; k < 2; k++) {
        const o = C.CELL * 0.18 + k * 8
        ctx.beginPath()
        ctx.moveTo(p.x - nrm.x * o - nrm.y * 7, p.y - nrm.y * o - nrm.x * 7)
        ctx.lineTo(p.x - nrm.x * (o + 7), p.y - nrm.y * (o + 7))
        ctx.lineTo(p.x - nrm.x * o + nrm.y * 7, p.y - nrm.y * o + nrm.x * 7)
        ctx.stroke()
      }
      if (owner) symChip(p.x + nrm.x * C.CELL * 0.42, p.y + nrm.y * C.CELL * 0.42, owner, pulse)
      ctx.restore()
    })
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
    landByRunway.forEach((group, idx) => {
      const r = W.runways[idx]!,
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
      const shared = group.length > 1
      group.forEach((pl, i) => {
        const lane = shared ? (i - (group.length - 1) / 2) * 20 : 0
        const ox = perpX * lane,
          oy = perpY * lane
        const pulse = planning && G.selected === pl.id ? 1 + 0.1 * Math.sin(G.clock * 7) : 1
        ctx.save()
        ctx.strokeStyle = pl.color
        ctx.lineWidth = 3.5 * pulse
        for (let k = 0; k < 2; k++) {
          const o = k * 11 - 2
          ctx.beginPath()
          ctx.moveTo(ap.x + ox + ux * o - uy * 9, ap.y + oy + uy * o + ux * 9)
          ctx.lineTo(ap.x + ox + ux * (o + 9), ap.y + oy + uy * (o + 9))
          ctx.lineTo(ap.x + ox + ux * o + uy * 9, ap.y + oy + uy * o - ux * 9)
          ctx.stroke()
        }
        symChip(ap.x + ox - ux * C.CELL * 0.45, ap.y + oy - uy * C.CELL * 0.45, pl, pulse)
        ctx.restore()
      })
    })
    if (planning)
      for (const pl of W.planes) {
        const sol = G.paths[pl.id]
        if (sol && sol.complete) continue
        const a = pl.mission === 'depart' ? cellC(W.runways[pl.rwIdx]!.end) : cellC(pl.spawn)
        const bb = cellC(targetCellOf(pl, W))
        ctx.save()
        ctx.globalAlpha = G.selected === pl.id ? 0.5 : 0.16
        ctx.strokeStyle = pl.color
        ctx.lineWidth = 2
        ctx.setLineDash([3, 8])
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(bb.x, bb.y)
        ctx.stroke()
        ctx.restore()
      }
    for (const pl of W.planes) {
      const sol = G.paths[pl.id]
      if (!sol || sol.cells.length < 2) continue
      const pts = pathPts(sol)
      ctx.save()
      ctx.globalAlpha = planning ? 0.95 : 0.2
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.strokeStyle = 'rgba(244,250,252,.85)'
      ctx.lineWidth = 8
      poly(pts)
      ctx.stroke()
      ctx.strokeStyle = pl.color
      ctx.lineWidth = 4.5
      poly(pts)
      ctx.stroke()
      if (planning && !sol.complete) {
        const e = pts[pts.length - 1]!
        ctx.setLineDash([4, 4])
        ctx.strokeStyle = '#FF5C5C'
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.arc(e.x, e.y, 13 + 3 * Math.sin(G.clock * 8), 0, TAU)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = '#FF5C5C'
        ctx.font = '800 16px ' + FONT
        ctx.textAlign = 'center'
        ctx.fillText('!', e.x, e.y + 5)
      }
      ctx.restore()
    }
    if (planning || !sim) {
      for (const pl of W.planes) {
        const home = planeHome(pl, W),
          sol = G.paths[pl.id]
        let ang: number
        if (sol && sol.cells.length > 1) {
          const a = cellC(sol.cells[0]!),
            b = cellC(sol.cells[1]!)
          ang = Math.atan2(b.y - a.y, b.x - a.x)
        } else if (pl.mission === 'depart') {
          const r = W.runways[pl.rwIdx]!
          ang = Math.atan2(r.dir.y, r.dir.x)
        } else {
          const t = cellC(targetCellOf(pl, W))
          ang = Math.atan2(t.y - home.y, t.x - home.x)
        }
        const sel = G.selected === pl.id
        if (sel && planning) {
          ctx.save()
          ctx.setLineDash([5, 7])
          ctx.strokeStyle = pl.color
          ctx.globalAlpha = 0.4
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(home.x, home.y, CONFIG.SEP_BLOCKS * C.CELL, 0, TAU)
          ctx.stroke()
          ctx.restore()
        }
        // Static parked plane: no hover bob, no spinning prop.
        drawPlane(ctx, pl.type, home.x, home.y, ang, pl.color, {
          scale: sel ? 1.08 : 1,
        })
        symChip(home.x, home.y - pl.type.r * 1.9, pl, sel ? 1.12 : 1)
      }
    } else {
      for (const p of sim.planes) {
        if (p.state !== 'flying') continue
        if (!sim.rolling(p)) {
          ctx.save()
          ctx.setLineDash([4, 7])
          ctx.strokeStyle = p.color
          ctx.globalAlpha = 0.13
          ctx.lineWidth = 2
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
    if (planning && G.ghostOn && G.ghost) {
      for (const p of (G.ghost as Sim).planes)
        if (p.state === 'flying')
          drawPlane(ctx, p.type, p.x, p.y, p.ang, p.color, {
            ghost: true,
            noShadow: true,
            spin: (G.ghost as Sim).t,
          })
      for (const f of G.ghostFx) {
        ctx.save()
        ctx.globalAlpha = 1 - f.t / 0.8
        if (f.sep) {
          ctx.strokeStyle = '#FFB948'
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.arc(f.x, f.y, 10 + f.t * 46, 0, TAU)
          ctx.stroke()
        } else {
          ctx.strokeStyle = '#FF5C5C'
          ctx.lineWidth = 4
          const r = 8 + f.t * 36
          ctx.beginPath()
          ctx.moveTo(f.x - r, f.y - r)
          ctx.lineTo(f.x + r, f.y + r)
          ctx.moveTo(f.x + r, f.y - r)
          ctx.lineTo(f.x - r, f.y + r)
          ctx.stroke()
        }
        ctx.restore()
      }
      G.ghostFx = G.ghostFx.filter((f: any) => (f.t += dt) < 0.8)
      ctx.fillStyle = 'rgba(244,235,216,.55)'
      ctx.font = '800 14px ' + FONT
      ctx.textAlign = 'center'
      ctx.fillText('👻 test flight ×5', C.W / 2, C.Y0 + 20)
    }
    renderFx(dt)
  }
  function renderFx(dt: number): void {
    for (const f of G.fx as Fx[]) {
      f.t += dt
      const p = f.t
      ctx.save()
      const fx = f.x ?? 0,
        fy = f.y ?? 0
      if (f.kind === 'floaty') {
        ctx.globalAlpha = clamp(1.4 - p, 0, 1)
        ctx.font = `800 ${f.size || 19}px ${FONT}`
        ctx.textAlign = 'center'
        ctx.lineWidth = 4
        ctx.strokeStyle = 'rgba(13,20,28,.8)'
        ctx.strokeText(f.txt || '', fx, fy - p * 32)
        ctx.fillStyle = f.color || '#F4EBD8'
        ctx.fillText(f.txt || '', fx, fy - p * 32)
      } else if (f.kind === 'sep') {
        ctx.globalAlpha = clamp(1 - p, 0, 1)
        ctx.strokeStyle = '#FFB948'
        ctx.lineWidth = 3.5
        ctx.beginPath()
        ctx.arc(fx, fy, 12 + p * 55, 0, TAU)
        ctx.stroke()
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(fx, fy, 12 + p * 34, 0, TAU)
        ctx.stroke()
      } else if (f.kind === 'bonk') {
        // Just the "BONK!" text — no star burst, no spinning planes.
        ctx.translate(fx, fy)
        ctx.globalAlpha = clamp(2 - p * 1.6, 0, 1)
        ctx.fillStyle = '#FF5C5C'
        roundRectPath(ctx, -46, -21, 92, 40, 10)
        ctx.fill()
        ctx.strokeStyle = '#F4EBD8'
        ctx.lineWidth = 3
        roundRectPath(ctx, -46, -21, 92, 40, 10)
        ctx.stroke()
        ctx.fillStyle = '#F4EBD8'
        ctx.font = '900 23px ' + FONT
        ctx.textAlign = 'center'
        ctx.fillText('BONK!', 0, 8)
      } else if (f.kind === 'intercept') {
        // Same banner style as BONK, but blue with "INTERCEPTED".
        ctx.translate(fx, fy)
        ctx.globalAlpha = clamp(2 - p * 1.6, 0, 1)
        ctx.font = '900 18px ' + FONT
        ctx.textAlign = 'center'
        const txt = 'INTERCEPTED'
        const w = ctx.measureText(txt).width + 30
        ctx.fillStyle = '#3478E0'
        roundRectPath(ctx, -w / 2, -21, w, 40, 10)
        ctx.fill()
        ctx.strokeStyle = '#F4EBD8'
        ctx.lineWidth = 3
        roundRectPath(ctx, -w / 2, -21, w, 40, 10)
        ctx.stroke()
        ctx.fillStyle = '#F4EBD8'
        ctx.fillText(txt, 0, 7)
      } else if (f.kind === 'arrive') {
        // Same banner style as BONK/INTERCEPTED, but green — "LANDED" on a
        // runway, "ROUTED" when handed off to a gate.
        ctx.translate(fx, fy)
        ctx.globalAlpha = clamp(2 - p * 1.6, 0, 1)
        ctx.font = '900 18px ' + FONT
        ctx.textAlign = 'center'
        const txt = f.txt || 'LANDED'
        const w = ctx.measureText(txt).width + 30
        ctx.fillStyle = '#33B36B'
        roundRectPath(ctx, -w / 2, -21, w, 40, 10)
        ctx.fill()
        ctx.strokeStyle = '#F4EBD8'
        ctx.lineWidth = 3
        roundRectPath(ctx, -w / 2, -21, w, 40, 10)
        ctx.stroke()
        ctx.fillStyle = '#F4EBD8'
        ctx.fillText(txt, 0, 7)
      } else if (f.kind === 'puff') {
        ctx.globalAlpha = clamp(0.8 - p, 0, 1)
        ctx.fillStyle = '#DCE7EE'
        for (let i = 0; i < 5; i++) {
          const a = (i * TAU) / 5
          ctx.beginPath()
          ctx.arc(fx + Math.cos(a) * p * 28, fy + Math.sin(a) * p * 28, 9 + p * 7, 0, TAU)
          ctx.fill()
        }
      } else if (f.kind === 'block') {
        ctx.globalAlpha = clamp(0.9 - p * 2, 0, 1)
        ctx.strokeStyle = '#FF5C5C'
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.arc(fx, fy, 11 + p * 28, 0, TAU)
        ctx.stroke()
      }
      ctx.restore()
    }
    G.fx = (G.fx as Fx[]).filter((f) => f.t < 1.5)
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
      const cp = clonePath(s[k as any])
      if (cp) o[k as any] = cp
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
      W = G.world as World
    const pl = W.planes.find((o) => dist(planeHome(o, W), p) < o.type.r + 22)
    if (pl) {
      G.drawing = {
        id: pl.id,
        prev: clonePath(G.paths[pl.id]),
        moved: false,
        minLen: pl.mission === 'depart' ? W.runways[pl.rwIdx]!.cells.length : 1,
      }
      const cells =
        pl.mission === 'depart'
          ? W.runways[pl.rwIdx]!.cells.map((c) => ({ x: c.x, y: c.y }))
          : [{ x: pl.spawn.x, y: pl.spawn.y }]
      G.paths[pl.id] = { cells, complete: false }
      G.selected = pl.id
      Sfx.honk()
      updateStatus()
      return
    }
    for (const o of W.planes) {
      const sol = G.paths[o.id]
      if (
        sol &&
        !sol.complete &&
        sol.cells.length > 1 &&
        dist(cellC(sol.cells[sol.cells.length - 1]!), p) < CONFIG.CELL * 0.9
      ) {
        G.drawing = {
          id: o.id,
          prev: clonePath(sol),
          moved: true,
          minLen: o.mission === 'depart' ? W.runways[o.rwIdx]!.cells.length : 1,
        }
        G.selected = o.id
        Sfx.plop()
        return
      }
    }
    G.tapCell = { c: pxCell(p), x: p.x, y: p.y }
  }
  function onPointerMove(e: PointerEvent): void {
    if (!G.drawing || G.phase !== 'plan') return
    e.preventDefault()
    const C = CONFIG,
      sol = G.paths[G.drawing.id] as PlanePath,
      cells = sol.cells
    const p = toWorld(e)
    p.x = clamp(p.x, C.X0 + 1, C.X0 + C.COLS * C.CELL - 1)
    p.y = clamp(p.y, C.Y0 + 1, C.Y0 + C.ROWS * C.CELL - 1)
    const cur = pxCell(p)
    let guard = 0
    while (!sameCell(cur, cells[cells.length - 1]!) && guard++ < 50) {
      const last = cells[cells.length - 1]!
      if (
        cells.length > G.drawing.minLen &&
        cells.length > 1 &&
        sameCell(cur, cells[cells.length - 2]!)
      ) {
        cells.pop()
        G.drawing.moved = true
        continue
      }
      const dx = Math.sign(cur.x - last.x),
        dy = Math.sign(cur.y - last.y)
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
      if (blockedCell(next)) {
        let alt: Cell | null = null
        if (dx && dy) {
          const c1 = { x: last.x + dx, y: last.y },
            c2 = { x: last.x, y: last.y + dy }
          if (!blockedCell(c1)) alt = c1
          else if (!blockedCell(c2)) alt = c2
        }
        if (!alt) {
          if (G.clock - G.blockFlashAt > 0.15) {
            const bp = cellC(next)
            addFx('block', { x: bp.x, y: bp.y })
            Sfx.buzz()
            vibrate(20)
            G.blockFlashAt = G.clock
          }
          break
        }
        next = alt
      }
      if (cells.length >= 120) break
      cells.push(next)
      G.drawing.moved = true
    }
  }
  function finishStroke(): void {
    const d = G.drawing
    if (!d) return
    G.drawing = null
    const W = G.world as World,
      pl = W.planes[d.id]!,
      sol = G.paths[d.id] as PlanePath
    if (!d.moved) {
      if (d.prev) G.paths[d.id] = d.prev
      else delete G.paths[d.id]
      updateStatus()
      emitSubmission()
      return
    }
    const tc = targetCellOf(pl, W),
      last = sol.cells[sol.cells.length - 1]!
    const ch = Math.max(Math.abs(last.x - tc.x), Math.abs(last.y - tc.y))
    if (ch <= CONFIG.SNAP_ADJ) {
      if (ch > 0) sol.cells.push({ x: tc.x, y: tc.y })
      sol.complete = true
      Sfx.snapOk()
      const tp = cellC(tc)
      addFx('floaty', { x: tp.x, y: tp.y - 16, txt: 'ROUTED ✓', color: pl.color, size: 16 })
      vibrate(12)
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
      const p = toWorld(e),
        tc = G.tapCell
      G.tapCell = null
      if (dist(p, tc) < 14) G.selected = null
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
    const W = G.world as World
    if (!W) return
    const n = W.planes.length
    const c = W.planes.filter((p) => G.paths[p.id] && G.paths[p.id].complete).length
    const status = q('.ba-status')
    if (G.phase === 'plan' && status) status.textContent = c + '/' + n
    const h = q('.ba-hint')
    if (!h) return
    const anyInc = W.planes.some(
      (p) => G.paths[p.id] && !G.paths[p.id].complete && G.paths[p.id].cells.length > 1
    )
    if (c === 0 && !anyInc)
      h.textContent = 'Drag a route from an aircraft to its target, square by square'
    else if (anyInc)
      h.textContent = 'Unfinished route (!) — keep dragging from its end, or redraw it'
    else if (c < n)
      h.textContent =
        n - c + (n - c === 1 ? ' aircraft still needs a route' : ' aircraft still need routes')
    else h.textContent = 'All routed — EXECUTE now: every spare second is +1 bonus'
  }

  /* ---------------- ghost test + lock-in ---------------- */
  function rebuildGhost(): void {
    const any = Object.values(G.paths).some((s: any) => s && s.cells.length > 1)
    if (!any) {
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
    let guard = 0
    while (!probe.finished() && guard++ < 10000) probe.step(CONFIG.SIM_DT)
    const TARGET_WATCH_SECONDS = 5
    G.simSpeed = clamp(probe.t / TARGET_WATCH_SECONDS, 1.5, 10)
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
  function handleEvent(ev: any): void {
    if (ev.type === 'done') {
      // Plane vanishes on arrival, leaving a green banner: "LANDED" on a runway,
      // "ROUTED" when handed off to a gate (transit/departure).
      G.runningScore += CONFIG.PTS_DONE
      Sfx.tada()
      addFx('arrive', { x: ev.p.x, y: ev.p.y, txt: ev.kind === 'runway' ? 'LANDED' : 'ROUTED' })
    } else if (ev.type === 'lost') {
      Sfx.lost()
      addFx('puff', { x: ev.p.x, y: ev.p.y })
    } else if (ev.type === 'bonk') {
      // No-fly zone → blue "INTERCEPTED" banner; storm/collision → red "BONK".
      Sfx.bonk()
      vibrate(80)
      addFx(ev.intercept ? 'intercept' : 'bonk', { x: ev.x, y: ev.y })
    } else if (ev.type === 'sep') {
      G.runningScore -= CONFIG.SEP_PENALTY
      Sfx.alert()
      vibrate(40)
      addFx('sep', { x: ev.x, y: ev.y })
    } else if (ev.type === 'star') {
      G.runningScore += CONFIG.PTS_STAR
      Sfx.star()
    }
  }

  /* ---------------- frame loop ---------------- */
  function loop(now: number): void {
    if (destroyed) return
    const dt = Math.min(0.05, (now - lastT) / 1000)
    lastT = now
    if (G.phase === 'plan') {
      if (!readOnly) {
        G.planLeft = Math.max(0, G.planLeft - dt)
        const s = Math.ceil(G.planLeft),
          t = q('.ba-timer')
        if (t) {
          t.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
          if (G.planLeft <= LOW_TIME) t.classList.add('low')
        }
        if (s < G.lastWhole) {
          G.lastWhole = s
          if (s <= LOW_TIME && s > 0) Sfx.tick()
        }
        if (G.ghostOn && G.ghost) {
          const ghost = G.ghost as Sim
          if (ghost.finished()) {
            G.ghostWait += dt
            if (G.ghostWait > 0.7) rebuildGhost()
          } else {
            G.ghostAcc += dt * 5
            while (G.ghostAcc >= CONFIG.SIM_DT) {
              G.ghostAcc -= CONFIG.SIM_DT
              for (const ev of ghost.step(CONFIG.SIM_DT)) {
                if (ev.type === 'bonk') G.ghostFx.push({ x: ev.x ?? 0, y: ev.y ?? 0, t: 0 })
                else if (ev.type === 'sep')
                  G.ghostFx.push({ x: ev.x ?? 0, y: ev.y ?? 0, t: 0, sep: true })
              }
            }
          }
        }
        if (G.planLeft <= 0) commitPlan()
      }
    } else if (G.phase === 'sim') {
      G.acc += dt * G.simSpeed
      const sim = G.sim as Sim
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
    if (readOnly) {
      if (botbar) botbar.hidden = true
      if (hint) hint.hidden = true
    } else {
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
            if (!Object.values(G.paths).some((s: any) => s && s.cells.length > 1)) {
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
      destroyed = true
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
/* eslint-enable */
