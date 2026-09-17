import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { positiveIntQuery } from '../../../common/validation/fields';

export const QueryPhotosSchema = z.strictObject({
  albumId: positiveIntQuery.optional(),
});

export class QueryPhotosDto extends createZodDto(QueryPhotosSchema) {}
