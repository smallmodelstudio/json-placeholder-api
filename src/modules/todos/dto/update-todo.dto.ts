import { createZodDto } from 'nestjs-zod';
import { CreateTodoSchema } from './create-todo.dto';

export const UpdateTodoSchema = CreateTodoSchema.partial();

export class UpdateTodoDto extends createZodDto(UpdateTodoSchema) {}
