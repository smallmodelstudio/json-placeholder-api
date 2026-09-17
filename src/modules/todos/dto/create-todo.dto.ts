import { createZodDto } from 'nestjs-zod';
import { TodoSchema } from '../entities/todo.entity';

export const CreateTodoSchema = TodoSchema.omit({ id: true });

export class CreateTodoDto extends createZodDto(CreateTodoSchema) {}
