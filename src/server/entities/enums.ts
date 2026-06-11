/**
 * @file src/server/entities/enums.ts
 * @description Database enum types for TypeORM entities
 * These must exactly match the PostgreSQL enum types defined in the schema
 */

/**
 * Difficulty level for content
 */
export enum DifficultyEnum {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
}

/**
 * Theme categories for trivia questions
 */
export enum QuestionThemeEnum {
  HISTORY = 'history',
  SCIENCE = 'science',
  SPORT = 'sport',
  CULTURE = 'culture',
  GEOGRAPHY = 'geography',
  TECHNOLOGY = 'technology',
  ART = 'art',
  OTHER = 'other',
}

/**
 * Programming languages for coding challenges
 */
export enum CodingLanguageEnum {
  JAVA = 'java',
  PYTHON = 'python',
  JAVASCRIPT = 'javascript',
  TYPESCRIPT = 'typescript',
  CPP = 'cpp',
  CSHARP = 'csharp',
  RUST = 'rust',
  GO = 'go',
  OTHER = 'other',
}

/**
 * Game modes available in a room
 */
export enum GameModeEnum {
  QUESTIONS = 'questions',
  CODING = 'coding',
  PUZZLES = 'puzzles',
}

/**
 * Status of a game room
 */
export enum RoomStatusEnum {
  LOBBY = 'lobby',
  ACTIVE = 'active',
  FINISHED = 'finished',
  ABANDONED = 'abandoned',
}

/**
 * Status of a round within a game
 */
export enum RoundStatusEnum {
  PENDING = 'pending',
  ACTIVE = 'active',
  SCORING = 'scoring',
  FINISHED = 'finished',
}

/**
 * Type of content in a round
 */
export enum ContentTypeEnum {
  QUESTION = 'question',
  CODING_CHALLENGE = 'coding_challenge',
  PUZZLE = 'puzzle',
}

/**
 * Kind of building block a host can place in a game flow.
 * - theme: a trivia category that expands into question rounds
 * - minigame: a self-contained mini-game module
 */
export enum BlockKindEnum {
  THEME = 'theme',
  MINIGAME = 'minigame',
}
