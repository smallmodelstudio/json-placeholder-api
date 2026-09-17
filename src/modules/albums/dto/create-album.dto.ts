import { createZodDto } from 'nestjs-zod';
import { AlbumSchema } from '../entities/album.entity';

export const CreateAlbumSchema = AlbumSchema.omit({ id: true });

export class CreateAlbumDto extends createZodDto(CreateAlbumSchema) {}
