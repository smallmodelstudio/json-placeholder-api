import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { positiveIntQuery } from '../../../common/validation/fields';

export const QueryCommentsSchema = z.strictObject({
  postId: positiveIntQuery.optional(),
});

export class QueryCommentsDto extends createZodDto(QueryCommentsSchema) {}
