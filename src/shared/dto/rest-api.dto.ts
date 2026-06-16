import { IsString } from 'class-validator'

export class KickPlayerDto {
  @IsString()
  public playerId!: string

  @IsString()
  public hostToken!: string
}
