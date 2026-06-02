/**
 * @file types/index.js
 * @owner git-master
 * @description JSDoc type definitions shared across all three runtime contexts.
 *
 * Documentation-only — zero runtime cost.
 * RULES:
 *  1. Every socket event payload must have a typedef here.
 *  2. Use @typedef only. No classes, no runtime objects.
 *  3. Keep types flat — nested shapes get their own @typedef.
 */

/** @typedef {'lobby'|'round-intro'|'playing'|'reveal'|'leaderboard'|'game-over'} GamePhase */
/** @typedef {'quiz'|'collab-puzzle'|'head-to-head'} RoundType */

/**
 * @typedef {Object} Player
 * @property {string}  id         - Socket ID assigned by server
 * @property {string}  name       - Display name chosen at join
 * @property {boolean} connected  - Live connection state
 * @property {number}  score      - Cumulative score
 */

/**
 * @typedef {Object} RoomState
 * @property {string}    code
 * @property {Player[]}  players
 * @property {GamePhase} phase
 * @property {number}    round    - 0-based index
 */

/**
 * @typedef {Object} QuestionState
 * @property {string}   id
 * @property {string}   text
 * @property {Answer[]} answers   - Pre-shuffled on server
 * @property {number}   timeLimit - Seconds allowed
 */

/**
 * @typedef {Object} Answer
 * @property {string} id
 * @property {string} text
 */

/** @typedef {Object.<string, number>} ScoreMap - playerId → score delta */
