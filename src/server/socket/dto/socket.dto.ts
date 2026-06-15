import { IsString, IsNumber, IsOptional, IsDefined } from 'class-validator'
import type { RoundType } from '../../../shared/types/index'

export class PingDto {
  @IsNumber()
  @IsOptional()
  t?: number
}

export class PlayerJoinDto {
  @IsString()
  roomCode!: string

  @IsString()
  playerName!: string

  @IsString()
  @IsOptional()
  playerId?: string

  @IsString()
  @IsOptional()
  playerToken?: string
}

export class AnswerSubmitDto {
  @IsString()
  answerId!: string

  @IsNumber()
  timestamp!: number
}

export class RoundSubmitDto {
  @IsString()
  roundId!: string

  @IsString()
  type!: RoundType

  @IsDefined()
  submission!: unknown

  @IsNumber()
  @IsOptional()
  timestamp?: number
}
