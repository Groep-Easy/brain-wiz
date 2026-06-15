import { IsString, IsOptional, IsArray, IsNumber } from 'class-validator'
import type { GameFlowItem } from '../../../shared/types/flow'

export class StartRoomDto {
  @IsString()
  @IsOptional()
  hostToken?: string
}

export class StoreFlowDto {
  @IsString()
  @IsOptional()
  hostToken?: string

  @IsArray()
  @IsOptional()
  flow?: GameFlowItem[]
}

export class RandomizeFlowDto {
  @IsString()
  @IsOptional()
  hostToken?: string

  @IsNumber()
  @IsOptional()
  size?: number
}
