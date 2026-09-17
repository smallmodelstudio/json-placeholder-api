import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { email, nonEmptyString } from '../../../common/validation/fields';

export const QueryUsersSchema = z.strictObject({
  username: nonEmptyString.optional(),
  email: email.optional(),
});

export class QueryUsersDto extends createZodDto(QueryUsersSchema) {}
