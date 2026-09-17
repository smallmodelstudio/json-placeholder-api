import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { positiveIntQuery } from '../../../common/validation/fields';

export const QueryPostsSchema = z.strictObject({
  userId: positiveIntQuery.optional(),
});

export class QueryPostsDto extends createZodDto(QueryPostsSchema) {}
