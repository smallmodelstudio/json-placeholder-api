import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
} from 'class-validator';

export class CreateTodoDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  userId!: number;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsBoolean()
  completed!: boolean;
}
