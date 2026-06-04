import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Question } from '../entities/question.entity'
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
    const filePath = path.resolve(process.cwd(), 'assets/test-data/questions.json')
    if (!fs.existsSync(filePath)) {
      this.logger.warn(`Seed file not found at ${filePath}. Skipping question seeding.`)
      return
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8')
    const seedQuestions = JSON.parse(fileContent)

    let insertedCount = 0
    for (const q of seedQuestions) {
      const existing = await this.questions.findOne({ where: { text: q.text } })
      if (!existing) {
        const question = this.questions.create({
          text: q.text,
          theme: q.theme,
          difficulty: q.difficulty,
          correctAnswers: q.correctAnswers,
          wrongAnswers: q.wrongAnswers,
          imagePath: q.imagePath || '',
          timeLimitSeconds: q.timeLimitSeconds,
          basePoints: q.basePoints,
        })
        await this.questions.save(question)
        insertedCount++
      }
    }

    if (insertedCount > 0) {
      this.logger.log(`Successfully seeded ${insertedCount} new questions.`)
    } else {
      this.logger.log('Questions already seeded, no new insertions needed.')
    }
  }
}
