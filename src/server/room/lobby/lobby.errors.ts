/**
 * @file lobby.errors.ts
 * @description Typed domain errors for the lobby flow. Adapters translate these
 * into HTTP status codes or PLAYER_JOIN_REJECTED reasons.
 */
export class NotEnoughPlayersError extends Error {
  public constructor(message = 'Not enough players to start') {
    super(message)
    this.name = 'NotEnoughPlayersError'
  }
}

export class InvalidHostTokenError extends Error {
  public constructor(message = 'Invalid host token') {
    super(message)
    this.name = 'InvalidHostTokenError'
  }
}

// Currently unused; kept for the join-validation flow that may adopt typed errors.
export class DisplayNameTakenError extends Error {
  public constructor(message = 'Display name is already taken in this room') {
    super(message)
    this.name = 'DisplayNameTakenError'
  }
}
