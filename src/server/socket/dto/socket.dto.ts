import { IsString, IsNumber, IsOptional, IsDefined, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import type { RoundType } from '../../../shared/types/index'

export class PingDto {
  @IsNumber()
  @IsOptional()
  public t?: number
}

export class PlayerAvatarDto {
  @IsString()
  public bodyColor!: string

  @IsNumber()
  public faceId!: number
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

  @IsOptional()
  @ValidateNested()
  @Type(() => PlayerAvatarDto)
  public playerAvatar?: PlayerAvatarDto
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
