import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, type DeepPartial } from 'typeorm'
import { Question } from '../entities/question.entity'
import { DEFAULT_BASE_POINTS } from './question-seeder.constants'
import { SeedQuestion } from './question-seeder.types'
import * as fs from 'fs'
import * as path from 'path'

/** Map a seed record to the question fields, applying the image/points defaults. */
export function toQuestionFields(q: SeedQuestion): DeepPartial<Question> {
  return {
    text: q.text,
    theme: q.theme,
    difficulty: q.difficulty,
    correctAnswers: q.correctAnswers,
    wrongAnswers: q.wrongAnswers,
    imagePath: q.imagePath || '',
    timeLimitSeconds: q.timeLimitSeconds,
    basePoints: q.basePoints ?? DEFAULT_BASE_POINTS,
  }
}

@Injectable()
export class QuestionSeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(QuestionSeederService.name)

  public constructor(
    @InjectRepository(Question) private readonly questions: Repository<Question>
  ) {}

  public async onApplicationBootstrap(): Promise<void> {
    try {
      await this.seedQuestions()
    } catch (error) {
      this.logger.error(
        `Failed to seed questions: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  private async seedQuestions(): Promise<void> {
    const dataDir = path.resolve(process.cwd(), 'assets/test-data')
    const files = this.resolveSeedFiles(dataDir)
    if (!files) return

    const seedQuestions = files.flatMap((file) => this.readSeedFile(path.join(dataDir, file)))
    const { inserted, skipped } = await this.insertSeedQuestions(seedQuestions)
    this.logSeedSummary(inserted, skipped, files.length)
  }

  /** Locate the seed `.json` files, logging and returning null when there are none. */
  private resolveSeedFiles(dataDir: string): string[] | null {
    if (!fs.existsSync(dataDir)) {
      this.logger.warn(`Seed directory not found at ${dataDir}. Skipping question seeding.`)
      return null
    }
    const files = fs.readdirSync(dataDir).filter((file) => file.endsWith('.json'))
    if (files.length === 0) {
      this.logger.warn(`No seed files found in ${dataDir}. Skipping question seeding.`)
      return null
    }
    return files
  }

  /** Insert each new, non-duplicate question; returns how many landed vs. failed. */
  private async insertSeedQuestions(
    seedQuestions: SeedQuestion[]
  ): Promise<{ inserted: number; skipped: number }> {
    let inserted = 0
    let skipped = 0
    const seenTexts = new Set<string>()
    for (const q of seedQuestions) {
      // Skip duplicates within the same run (themed files overlap with questions.json).
      if (seenTexts.has(q.text)) continue
      seenTexts.add(q.text)

      const existing = await this.questions.findOne({ where: { text: q.text } })
      if (existing) continue

      if (await this.insertOne(q)) {
        inserted++
      } else {
        skipped++
      }
    }
    return { inserted, skipped }
  }

  /** Persist one seed question; returns false (and logs) when it is rejected. */
  private async insertOne(q: SeedQuestion): Promise<boolean> {
    try {
      await this.questions.save(this.questions.create(toQuestionFields(q)))
      return true
    } catch (error) {
      this.logger.warn(
        `Skipped invalid seed question "${q.text}": ${
          error instanceof Error ? error.message : String(error)
        }`
      )
      return false
    }
  }

  private logSeedSummary(inserted: number, skipped: number, fileCount: number): void {
    if (inserted > 0) {
      this.logger.log(
        `Successfully seeded ${inserted} new questions from ${fileCount} file(s).` +
          (skipped > 0 ? ` Skipped ${skipped} invalid question(s).` : '')
      )
    } else if (skipped > 0) {
      this.logger.warn(`No questions seeded: all ${skipped} candidate(s) were invalid.`)
    } else {
      this.logger.log('Questions already seeded, no new insertions needed.')
    }
  }

  private readSeedFile(filePath: string): SeedQuestion[] {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      if (!Array.isArray(parsed)) {
        this.logger.warn(`Seed file ${path.basename(filePath)} is not a JSON array. Skipping.`)
        return []
      }
      return parsed as SeedQuestion[]
    } catch (error) {
      this.logger.warn(
        `Failed to read seed file ${path.basename(filePath)}: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
      return []
    }
  }
}
