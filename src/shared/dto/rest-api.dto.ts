import { IsString } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class KickPlayerDto {
  @ApiProperty({
    description: 'The unique ID of the player that should be kicked',
    example: 'player_12345',
  })
  @IsString()
  public playerId!: string

  @ApiProperty({
    description: 'Token of the host who is authorized to perform this action',
    example: 'host_token_abc123',
  })
  @IsString()
  public hostToken!: string
}

export class BasicResponseDto {
  @ApiProperty({
    description: 'Indicates whether the kick action was successful',
    example: true,
  })
  public success!: boolean

  @ApiPropertyOptional({
    description: 'Reason why the action failed (if applicable)',
    example: 'NOT_AUTHORIZED',
  })
  public reason?: string
}
