/**
 * Tunable constants for the Bonk Air ("Sector Control") minigame engine.
 * Ported verbatim from the standalone prototype so generation + simulation stay
 * deterministic. Grid is 24x10 blocks of 52px laid out at (X0, Y0) on a 1280x720
 * stage. Keep this dependency-free: it is shared by the server scorer, the React
 * component, and the unit tests.
 */
export const CONFIG = {
  W: 1280,
  H: 720,
  COLS: 24,
  ROWS: 10,
  CELL: 52,
  X0: 16,
  Y0: 96,
  PLAN_SECONDS: 30,
  SIM_DT: 1 / 30,
  MAX_SIM_T: 120,
  SEP_BLOCKS: 2.0,
  SEP_REARM: 2.4,
  SEP_PENALTY: 150,
  BONK_BLOCKS: 0.95,
  // Scoring is tuned so a flawless easy round (3 aircraft + 2 stars + perfect
  // bonus + full early bonus) tops out at ~3000 points:
  //   3 * PTS_DONE (2400) + 2 * PTS_STAR (200) + PTS_PERFECT (200) + EARLY_MAX (200)
  PTS_DONE: 800,
  PTS_STAR: 100,
  PTS_PERFECT: 200,
  // Early (TAKE OFF) bonus: EARLY_PER_SECOND points per whole second left when
  // every aircraft is routed, capped at EARLY_MAX.
  EARLY_PER_SECOND: 10,
  EARLY_MAX: 200,
  SNAP_ADJ: 1,
} as const

export const TAU = Math.PI * 2
