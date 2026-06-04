/* eslint-disable @typescript-eslint/no-magic-numbers */
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
import { DifficultyEnum, QuestionThemeEnum } from '../../entities/enums.js'

export class CreateQuestionDto {
  @IsString()
  @MaxLength(512)
  public text!: string

  @IsEnum(QuestionThemeEnum)
  public theme!: QuestionThemeEnum

  @IsEnum(DifficultyEnum)
  public difficulty!: DifficultyEnum

  @IsArray()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(512, { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  public correctAnswers!: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(512, { each: true })
  @ArrayMaxSize(1)
  public wrongAnswers?: string[]

  @IsOptional()
  @IsString()
  @MaxLength(512)
  public imagePath?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(32767)
  public timeLimitSeconds?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(32767)
  public basePoints?: number
}
