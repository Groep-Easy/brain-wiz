/**
 * @file game-limits.ts
 * @description Domain validation limits owned by shared (room-code length and
 * player-name bounds). Lives here so room-code/display-name validation has no
 * dependency on config; config re-exports these via ROOM/PLAYER.
 */
export const ROOM_CODE_LENGTH = 4

export const PLAYER_NAME_MIN_LENGTH = 1
export const PLAYER_NAME_MAX_LENGTH = 24
