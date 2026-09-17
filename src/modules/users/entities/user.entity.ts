import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  email,
  latitudeString,
  longitudeString,
  nonEmptyString,
  positiveIntBody,
} from '../../../common/validation/fields';

export const GeoSchema = z.strictObject({
  lat: latitudeString,
  lng: longitudeString,
});

export class Geo extends createZodDto(GeoSchema) {}

export const AddressSchema = z.strictObject({
  street: nonEmptyString,
  suite: nonEmptyString,
  city: nonEmptyString,
  zipcode: nonEmptyString,
  geo: GeoSchema,
});

export class Address extends createZodDto(AddressSchema) {}

export const CompanySchema = z.strictObject({
  name: nonEmptyString,
  catchPhrase: nonEmptyString,
  bs: nonEmptyString,
});

export class Company extends createZodDto(CompanySchema) {}

export const UserSchema = z.strictObject({
  id: positiveIntBody,
  name: nonEmptyString,
  username: nonEmptyString,
  email,
  address: AddressSchema,
  phone: nonEmptyString,
  website: nonEmptyString,
  company: CompanySchema,
});

export class User extends createZodDto(UserSchema) {}
