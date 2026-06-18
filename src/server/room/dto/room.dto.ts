import { IsString, IsOptional, IsArray, IsNumber } from 'class-validator'
import type { GameFlowItem } from '@brain-wiz/shared/types/flow'

export class StartRoomDto {
  @IsString()
  @IsOptional()
  public hostToken?: string
}

export class StoreFlowDto {
  @IsString()
  @IsOptional()
  public hostToken?: string

  @IsArray()
  @IsOptional()
  public flow?: GameFlowItem[]
}

export class RandomizeFlowDto {
  @IsString()
  @IsOptional()
  public hostToken?: string

  @IsNumber()
  @IsOptional()
  public size?: number
}
