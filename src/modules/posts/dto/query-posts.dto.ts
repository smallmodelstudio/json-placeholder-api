import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive } from 'class-validator';

export class QueryPostsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  userId?: number;
}
