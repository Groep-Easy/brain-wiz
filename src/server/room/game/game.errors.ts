/**
 * @file game.errors.ts
 * @owner server-squad
 */
export class NotEnoughQuestionsError extends Error {
  public constructor(requested: number, available: number) {
    super(`Not enough questions to build a game: needed ${requested}, found ${available}`)
    this.name = 'NotEnoughQuestionsError'
  }
}
