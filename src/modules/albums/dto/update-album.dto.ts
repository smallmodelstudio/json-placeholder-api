import { createZodDto } from 'nestjs-zod';
import { CreateAlbumSchema } from './create-album.dto';

export const UpdateAlbumSchema = CreateAlbumSchema.partial();

export class UpdateAlbumDto extends createZodDto(UpdateAlbumSchema) {}
