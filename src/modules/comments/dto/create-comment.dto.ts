import { createZodDto } from 'nestjs-zod';
import { CommentSchema } from '../entities/comment.entity';

export const CreateCommentSchema = CommentSchema.omit({ id: true });

export class CreateCommentDto extends createZodDto(CreateCommentSchema) {}
