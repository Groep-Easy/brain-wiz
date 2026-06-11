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

export class CreateQuestionDto {
  @ApiProperty({
    example: 'What is the capital of France?',
    maxLength: 512,
  })
  @IsString()
  @MaxLength(512)
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
    maxItems: 2,
  })
  @IsArray()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(512, { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
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
  @MaxLength(512, { each: true })
  @ArrayMaxSize(1)
  public wrongAnswers?: string[]

  @ApiPropertyOptional({
    example: '/images/france.png',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  public imagePath?: string

  @ApiPropertyOptional({
    example: 30,
    minimum: 1,
    maximum: 32767,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(32767)
  public timeLimitSeconds?: number

  @ApiPropertyOptional({
    example: 10,
    minimum: 0,
    maximum: 32767,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(32767)
  public basePoints?: number
}
