import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common'
import { QuestionService } from './question.service'
import { CreateQuestionDto } from './dto/create-question.dto'
import { ApiKeyGuard } from '../utils/api-key.guard'

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
