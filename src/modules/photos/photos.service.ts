import { Injectable } from '@nestjs/common';
import { UpstreamService } from '../../upstream/upstream.service';
import { CreatePhotoDto } from './dto/create-photo.dto';
import { QueryPhotosDto } from './dto/query-photos.dto';
import { UpdatePhotoDto } from './dto/update-photo.dto';
import { Photo } from './entities/photo.entity';

@Injectable()
export class PhotosService {
  constructor(private readonly upstream: UpstreamService) {}

  findAll(query: QueryPhotosDto): Promise<Photo[]> {
    return this.upstream.get<Photo[]>('/photos', {
      params:
        query.albumId !== undefined ? { albumId: query.albumId } : undefined,
    });
  }

  findOne(id: number): Promise<Photo> {
    return this.upstream.get<Photo>(`/photos/${id}`);
  }

  create(dto: CreatePhotoDto): Promise<Photo> {
    return this.upstream.post<Photo>('/photos', dto);
  }

  update(id: number, dto: UpdatePhotoDto): Promise<Photo> {
    return this.upstream.put<Photo>(`/photos/${id}`, dto);
  }

  patch(id: number, dto: UpdatePhotoDto): Promise<Photo> {
    return this.upstream.patch<Photo>(`/photos/${id}`, dto);
  }

  remove(id: number): Promise<object> {
    return this.upstream.delete<object>(`/photos/${id}`);
  }
}
