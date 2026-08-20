import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  IsUrl,
} from 'class-validator';

export class CreatePhotoDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  albumId!: number;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsUrl()
  url!: string;

  @IsUrl()
  thumbnailUrl!: string;
}
