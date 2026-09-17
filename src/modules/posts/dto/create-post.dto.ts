import { createZodDto } from 'nestjs-zod';
import { PostSchema } from '../entities/post.entity';

export const CreatePostSchema = PostSchema.omit({ id: true });

export class CreatePostDto extends createZodDto(CreatePostSchema) {}
