/**
 * @file types/index.ts
 * @owner git-master
 * @description Barrel of the wire types shared across all three runtime contexts.
 *
 * The definitions live in the per-feature sibling modules so a feature only
 * touches its own slice (instead of one ever-growing file). Add new types to the
 * relevant module; this barrel re-exports them.
 *
 * Type-only (zero runtime cost) except `DEFAULT_PLAYER_AVATAR`.
 * RULES:
 *  1. Every socket event payload must have a type in one of these modules.
 *  2. Types only. No classes, no runtime objects (bar the avatar default).
 *  3. Keep types flat — nested shapes get their own type.
 */

export * from './game'
export * from './player'
export * from './room'
export * from './connection'
export * from './question'
export * from './round'
export * from './leaderboard'
