import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  nonEmptyString,
  positiveIntBody,
} from '../../../common/validation/fields';

export const AlbumSchema = z.strictObject({
  id: positiveIntBody,
  userId: positiveIntBody,
  title: nonEmptyString,
});

export class Album extends createZodDto(AlbumSchema) {}
