import { createZodDto } from 'nestjs-zod';
import { CreateCommentSchema } from './create-comment.dto';

export const UpdateCommentSchema = CreateCommentSchema.partial();

export class UpdateCommentDto extends createZodDto(UpdateCommentSchema) {}
