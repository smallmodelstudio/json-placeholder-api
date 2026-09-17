import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  nonEmptyString,
  positiveIntBody,
} from '../../../common/validation/fields';

export const PostSchema = z.strictObject({
  id: positiveIntBody,
  userId: positiveIntBody,
  title: nonEmptyString,
  body: nonEmptyString,
});

export class Post extends createZodDto(PostSchema) {}
