import { createZodDto } from 'nestjs-zod';
import { PhotoSchema } from '../entities/photo.entity';

export const CreatePhotoSchema = PhotoSchema.omit({ id: true });

export class CreatePhotoDto extends createZodDto(CreatePhotoSchema) {}
