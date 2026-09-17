import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  httpUrl,
  nonEmptyString,
  positiveIntBody,
} from '../../../common/validation/fields';

export const PhotoSchema = z.strictObject({
  id: positiveIntBody,
  albumId: positiveIntBody,
  title: nonEmptyString,
  url: httpUrl,
  thumbnailUrl: httpUrl,
});

export class Photo extends createZodDto(PhotoSchema) {}
