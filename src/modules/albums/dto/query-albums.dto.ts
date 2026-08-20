import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive } from 'class-validator';

export class QueryAlbumsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  userId?: number;
}
