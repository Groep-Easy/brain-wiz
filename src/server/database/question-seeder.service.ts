import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Question } from '../entities/question.entity'
import { DEFAULT_BASE_POINTS } from './question-seeder.constants'
import { SeedQuestion } from './question-seeder.types'
import * as fs from 'fs'
import * as path from 'path'

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
    if (!fs.existsSync(dataDir)) {
      this.logger.warn(`Seed directory not found at ${dataDir}. Skipping question seeding.`)
      return
    }

    const files = fs.readdirSync(dataDir).filter((file) => file.endsWith('.json'))
    if (files.length === 0) {
      this.logger.warn(`No seed files found in ${dataDir}. Skipping question seeding.`)
      return
    }

    const seedQuestions = files.flatMap((file) => this.readSeedFile(path.join(dataDir, file)))

    let insertedCount = 0
    let skippedCount = 0
    const seenTexts = new Set<string>()
    for (const q of seedQuestions) {
      // Skip duplicates within the same run (themed files overlap with questions.json).
      if (seenTexts.has(q.text)) continue
      seenTexts.add(q.text)

      const existing = await this.questions
        .createQueryBuilder('question')
        .where('question.text = :text', { text: q.text })
        .getOne()

      if (existing) continue

      try {
        const question = this.questions.create({
          text: q.text,
          theme: q.theme,
          difficulty: q.difficulty,
          correctAnswers: q.correctAnswers,
          wrongAnswers: q.wrongAnswers,
          imagePath: q.imagePath || '',
          timeLimitSeconds: q.timeLimitSeconds,
          basePoints: q.basePoints ?? DEFAULT_BASE_POINTS,
        })
        await this.questions.save(question)
        insertedCount++
      } catch (error) {
        skippedCount++
        this.logger.warn(
          `Skipped invalid seed question "${q.text}": ${
            error instanceof Error ? error.message : String(error)
          }`
        )
      }
    }

    if (insertedCount > 0) {
      this.logger.log(
        `Successfully seeded ${insertedCount} new questions from ${files.length} file(s).` +
          (skippedCount > 0 ? ` Skipped ${skippedCount} invalid question(s).` : '')
      )
    } else if (skippedCount > 0) {
      this.logger.warn(`No questions seeded: all ${skippedCount} candidate(s) were invalid.`)
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
