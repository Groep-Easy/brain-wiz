import { DifficultyEnum, QuestionThemeEnum } from '../entities/enums'

/** Shape of a question record in the assets/test-data/*.json seed files. */
export interface SeedQuestion {
  text: string
  theme: QuestionThemeEnum
  difficulty: DifficultyEnum
  correctAnswers: string[]
  wrongAnswers: string[]
  imagePath?: string
  timeLimitSeconds: number | null
  basePoints?: number
}
