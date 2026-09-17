import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { positiveIntQuery } from '../../../common/validation/fields';

export const QueryAlbumsSchema = z.strictObject({
  userId: positiveIntQuery.optional(),
});

export class QueryAlbumsDto extends createZodDto(QueryAlbumsSchema) {}
