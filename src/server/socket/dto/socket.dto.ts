import { IsString, IsNumber, IsOptional, IsDefined } from 'class-validator'
import type { RoundType } from '../../../shared/types/index'

export class PingDto {
  @IsNumber()
  @IsOptional()
  public t?: number
}

export class PlayerJoinDto {
  @IsString()
  public roomCode!: string

  @IsString()
  public playerName!: string

  @IsString()
  @IsOptional()
  public playerId?: string

  @IsString()
  @IsOptional()
  public playerToken?: string
}

export class AnswerSubmitDto {
  @IsString()
  public answerId!: string

  @IsNumber()
  public timestamp!: number
}

export class RoundSubmitDto {
  @IsString()
  public roundId!: string

  @IsString()
  public type!: RoundType

  @IsDefined()
  public submission!: unknown

  @IsNumber()
  @IsOptional()
  public timestamp?: number
}
