/**
 * @file room.errors.ts
 * @description Typed domain errors for room state. Adapters translate these
 * into HTTP status codes.
 */
export class RoomNotFoundError extends Error {
  public constructor(message = 'Room not found') {
    super(message)
    this.name = 'RoomNotFoundError'
  }
}

export class RoomNotInLobbyError extends Error {
  public constructor(message = 'Room is not accepting players') {
    super(message)
    this.name = 'RoomNotInLobbyError'
  }
}

// Currently unused; kept for the join-validation flow that may adopt typed errors.
export class RoomFullError extends Error {
  public constructor(message = 'Room is full') {
    super(message)
    this.name = 'RoomFullError'
  }
}
