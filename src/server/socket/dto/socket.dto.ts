import {
  IsString,
  IsNumber,
  IsInt,
  IsOptional,
  IsDefined,
  ValidateNested,
  Matches,
  Min,
  Max,
  Length,
} from 'class-validator'
import { Type } from 'class-transformer'
import type { RoundType } from '@brain-wiz/shared/types/index'
import {
  ROOM_CODE_LENGTH,
  AVATAR_FACE_COUNT,
  BODY_COLOR_PATTERN,
} from '@brain-wiz/shared/constants/game-limits'

export class PingDto {
  @IsNumber()
  @IsOptional()
  public t?: number
}

export class PlayerAvatarDto {
  @IsString()
  @Matches(BODY_COLOR_PATTERN, { message: 'bodyColor must be a 6-digit hex colour, e.g. #ff2d2d' })
  public bodyColor!: string

  @IsInt()
  @Min(0)
  @Max(AVATAR_FACE_COUNT - 1)
  public faceId!: number
}
export class PlayerJoinDto {
  @IsString()
  @Length(ROOM_CODE_LENGTH, ROOM_CODE_LENGTH)
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

export class RoundProgressDto extends RoundSubmitDto {}
