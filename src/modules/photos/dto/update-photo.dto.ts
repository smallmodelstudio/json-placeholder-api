import { createZodDto } from 'nestjs-zod';
import { CreatePhotoSchema } from './create-photo.dto';

export const UpdatePhotoSchema = CreatePhotoSchema.partial();

export class UpdatePhotoDto extends createZodDto(UpdatePhotoSchema) {}
