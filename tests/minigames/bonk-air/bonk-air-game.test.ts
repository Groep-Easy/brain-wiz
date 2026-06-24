import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  CONFIG,
  generate,
  hashSeed,
  runHeadless,
  scoreBonkAirSolution,
  type BonkAirSolution,
  type World,
} from '../../../src/minigames/bonk-air/shared/bonkAirGame.js'

const SEED = 'room-1:round-1:bonk-air'

/** Build a "fly the par route" plan: each plane follows its auto-routed path. */
function autoSolution(world: World): BonkAirSolution {
  const solution: BonkAirSolution = {}
  for (const pl of world.planes) {
    let cells = pl.bfs.map((c) => ({ x: c.x, y: c.y }))
    const runway = world.runways[pl.rwIdx]
    if (pl.mission === 'depart' && runway) {
      cells = runway.cells.map((c) => ({ x: c.x, y: c.y })).concat(cells.slice(1))
    }
    solution[pl.id] = { cells, complete: true }
  }
  return solution
}

describe('bonkAirGame', () => {
  it('generates the same world for the same seed + difficulty', () => {
    const a = generate(hashSeed(SEED), 2)
    const b = generate(hashSeed(SEED), 2)
    assert.equal(a.planes.length, b.planes.length)
    assert.deepEqual(
      a.planes.map((p) => [p.id, p.type.key, p.mission, p.spawn]),
      b.planes.map((p) => [p.id, p.type.key, p.mission, p.spawn])
    )
    assert.deepEqual(Array.from(a.blocked), Array.from(b.blocked))
    assert.deepEqual(a.gates, b.gates)
    assert.deepEqual(a.stars, b.stars)
  })

  it('always produces a routable roster of three planes', () => {
    for (let diff = 1; diff <= 3; diff++) {
      const world = generate(hashSeed(`${SEED}:${diff}`), diff)
      assert.equal(world.planes.length, 3)
      for (const pl of world.planes) {
        assert.ok(pl.bfs.length >= 1)
        assert.equal(pl.type.key, 'cessna')
      }
    }
  })

  it('scores an empty plan as zero', () => {
    const world = generate(hashSeed(SEED), 2)
    const results = runHeadless(world, {})
    assert.equal(results.score, 0)
    assert.equal(results.violations, 0)
  })

  it('awards landing/route points for a completed plan', () => {
    const world = generate(hashSeed(SEED), 2)
    const results = runHeadless(world, autoSolution(world))
    const completed = results.per.filter((r) => r.base > 0).length
    assert.ok(completed >= 1)
    assert.ok(results.score > 0)
  })

  it('adds the quick-planning bonus only when every plane is routed and time remains', () => {
    const world = generate(hashSeed(SEED), 2)
    const config = { timeLimitMs: CONFIG.PLAN_SECONDS * 1000, earlyMax: CONFIG.EARLY_MAX }
    const puzzle = { seed: SEED, diff: 2 }

    const fast = scoreBonkAirSolution(puzzle, autoSolution(world), config, 0)
    assert.equal(fast.allComplete, true)
    assert.equal(fast.earlyBonus, CONFIG.EARLY_MAX)

    const slow = scoreBonkAirSolution(puzzle, autoSolution(world), config, config.timeLimitMs)
    assert.equal(slow.earlyBonus, 0)

    const empty = scoreBonkAirSolution(puzzle, {}, config, 0)
    assert.equal(empty.allComplete, false)
    assert.equal(empty.earlyBonus, 0)
  })

  it('penalises a reckless straight-line plan that busts separation', () => {
    const world = generate(hashSeed(SEED), 2)
    // Straight lines from each spawn to its target ignore separation entirely.
    const solution: BonkAirSolution = {}
    for (const pl of world.planes) {
      const from = pl.spawn
      const to =
        pl.mission === 'land' ? world.runways[pl.target.idx]?.thr : world.gates[pl.target.idx]?.c
      if (!to) continue
      solution[pl.id] = { cells: [from, to], complete: true }
    }
    const results = runHeadless(world, solution)
    assert.ok(results.violations >= 0)
    assert.equal(typeof results.score, 'number')
    assert.ok(Number.isFinite(results.score))
  })
})
