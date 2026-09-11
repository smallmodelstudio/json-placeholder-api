import { IsEmail, IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class QueryUsersDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  username?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
