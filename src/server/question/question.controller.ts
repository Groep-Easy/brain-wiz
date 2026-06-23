import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { QuestionService } from './question.service'
import { CreateQuestionDto } from './dto/create-question.dto'
import { ApiKeyGuard } from '../utils/api-key.guard'
import { ApiBody, ApiHeader, ApiOperation } from '@nestjs/swagger'
import { HTTP_THROTTLE } from '@brain-wiz/config/game.config'

@ApiHeader({
  name: 'x-api-key',
  required: true,
  description: 'API key required to access this endpoint',
})
@Controller('questions')
@UseGuards(ApiKeyGuard)
export class QuestionController {
  public constructor(private readonly questionService: QuestionService) {}

  @Post()
  @Throttle({ default: { ttl: HTTP_THROTTLE.STRICT_TTL_MS, limit: HTTP_THROTTLE.STRICT_LIMIT } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a question',
    description: 'Creates a new question and returns its ID',
  })
  @ApiBody({
    type: CreateQuestionDto,
    description: 'Data required to create a question',
  })
  public async createQuestion(@Body() dto: CreateQuestionDto): Promise<{ id: string }> {
    const id = await this.questionService.createQuestion(dto)
    return { id }
  }
}
