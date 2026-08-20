import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsPositive, IsString } from 'class-validator';

export class CreateAlbumDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  userId!: number;

  @IsString()
  @IsNotEmpty()
  title!: string;
}
