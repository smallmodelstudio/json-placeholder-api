import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive } from 'class-validator';

export class QueryPhotosDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  albumId?: number;
}
