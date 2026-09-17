import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  nonEmptyString,
  positiveIntBody,
} from '../../../common/validation/fields';

export const TodoSchema = z.strictObject({
  id: positiveIntBody,
  userId: positiveIntBody,
  title: nonEmptyString,
  completed: z.boolean(),
});

export class Todo extends createZodDto(TodoSchema) {}
