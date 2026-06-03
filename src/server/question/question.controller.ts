import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common'
import { QuestionService } from './question.service.js'
import { CreateQuestionDto } from './dto/create-question.dto.js'
import { ApiKeyGuard } from '../utils/api-key.guard.js'

@Controller('questions')
@UseGuards(ApiKeyGuard)
export class QuestionController {
  public constructor(private readonly questionService: QuestionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  public async createQuestion(@Body() dto: CreateQuestionDto): Promise<{ id: string }> {
    const id = await this.questionService.createQuestion(dto)
    return { id }
  }
}
