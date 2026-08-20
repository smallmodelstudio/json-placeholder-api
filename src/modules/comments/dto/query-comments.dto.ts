import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive } from 'class-validator';

export class QueryCommentsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  postId?: number;
}
