import { Type } from 'class-transformer';
import {
  IsEmail,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNotEmptyObject,
  IsString,
  ValidateNested,
} from 'class-validator';

class GeoDto {
  @IsLatitude()
  lat!: string;

  @IsLongitude()
  lng!: string;
}

class AddressDto {
  @IsString()
  @IsNotEmpty()
  street!: string;

  @IsString()
  @IsNotEmpty()
  suite!: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsNotEmpty()
  zipcode!: string;

  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => GeoDto)
  geo!: GeoDto;
}

class CompanyDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  catchPhrase!: string;

  @IsString()
  @IsNotEmpty()
  bs!: string;
}

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsEmail()
  email!: string;

  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => AddressDto)
  address!: AddressDto;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsNotEmpty()
  website!: string;

  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => CompanyDto)
  company!: CompanyDto;
}
