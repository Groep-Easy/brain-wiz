import {
  IsString,
  MaxLength,
  IsEnum,
  IsArray,
  IsOptional,
  IsInt,
  Min,
  Max,
  ArrayMinSize,
  ArrayMaxSize,
  MinLength,
} from 'class-validator'
import { DifficultyEnum, QuestionThemeEnum } from '../../entities/enums'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

const TEXT_MAX_LENGTH = 512
const MAX_CORRECT_ANSWERS = 2
const SMALLINT_MAX = 32767

export class CreateQuestionDto {
  @ApiProperty({
    example: 'What is the capital of France?',
    maxLength: TEXT_MAX_LENGTH,
  })
  @IsString()
  @MaxLength(TEXT_MAX_LENGTH)
  public text!: string

  @ApiProperty({
    enum: QuestionThemeEnum,
    example: QuestionThemeEnum.GEOGRAPHY,
  })
  @IsEnum(QuestionThemeEnum)
  public theme!: QuestionThemeEnum

  @ApiProperty({
    enum: DifficultyEnum,
    example: DifficultyEnum.EASY,
  })
  @IsEnum(DifficultyEnum)
  public difficulty!: DifficultyEnum

  @ApiProperty({
    type: [String],
    example: ['Paris'],
    minItems: 1,
    maxItems: MAX_CORRECT_ANSWERS,
  })
  @IsArray()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(TEXT_MAX_LENGTH, { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_CORRECT_ANSWERS)
  public correctAnswers!: string[]

  @ApiPropertyOptional({
    type: [String],
    example: ['London'],
    maxItems: 1,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(TEXT_MAX_LENGTH, { each: true })
  @ArrayMaxSize(1)
  public wrongAnswers?: string[]

  @ApiPropertyOptional({
    example: '/images/france.png',
  })
  @IsOptional()
  @IsString()
  @MaxLength(TEXT_MAX_LENGTH)
  public imagePath?: string

  @ApiPropertyOptional({
    example: 30,
    minimum: 1,
    maximum: SMALLINT_MAX,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(SMALLINT_MAX)
  public timeLimitSeconds?: number

  @ApiPropertyOptional({
    example: 10,
    minimum: 0,
    maximum: SMALLINT_MAX,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(SMALLINT_MAX)
  public basePoints?: number
}
