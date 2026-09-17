import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  email,
  nonEmptyString,
  positiveIntBody,
} from '../../../common/validation/fields';

export const CommentSchema = z.strictObject({
  id: positiveIntBody,
  postId: positiveIntBody,
  name: nonEmptyString,
  email,
  body: nonEmptyString,
});

export class Comment extends createZodDto(CommentSchema) {}
