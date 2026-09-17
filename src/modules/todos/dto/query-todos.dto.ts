import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { positiveIntQuery } from '../../../common/validation/fields';

export const QueryTodosSchema = z.strictObject({
  userId: positiveIntQuery.optional(),
});

export class QueryTodosDto extends createZodDto(QueryTodosSchema) {}
