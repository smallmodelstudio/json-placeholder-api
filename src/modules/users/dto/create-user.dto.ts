import { createZodDto } from 'nestjs-zod';
import { UserSchema } from '../entities/user.entity';

export const CreateUserSchema = UserSchema.omit({ id: true });

export class CreateUserDto extends createZodDto(CreateUserSchema) {}
