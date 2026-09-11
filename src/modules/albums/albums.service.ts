import { Injectable } from '@nestjs/common';
import { UpstreamService } from '../../upstream/upstream.service';
import { Photo } from '../photos/entities/photo.entity';
import { PhotosService } from '../photos/photos.service';
import { CreateAlbumDto } from './dto/create-album.dto';
import { QueryAlbumsDto } from './dto/query-albums.dto';
import { UpdateAlbumDto } from './dto/update-album.dto';
import { Album } from './entities/album.entity';

@Injectable()
export class AlbumsService {
  constructor(
    private readonly upstream: UpstreamService,
    private readonly photosService: PhotosService,
  ) {}

  findAll(query: QueryAlbumsDto): Promise<Album[]> {
    return this.upstream.get<Album[]>('/albums', {
      ...(query.userId !== undefined && { params: { userId: query.userId } }),
    });
  }

  findOne(id: number): Promise<Album> {
    return this.upstream.get<Album>(`/albums/${id}`);
  }

  create(dto: CreateAlbumDto): Promise<Album> {
    return this.upstream.post<Album>('/albums', dto);
  }

  update(id: number, dto: UpdateAlbumDto): Promise<Album> {
    return this.upstream.put<Album>(`/albums/${id}`, dto);
  }

  patch(id: number, dto: UpdateAlbumDto): Promise<Album> {
    return this.upstream.patch<Album>(`/albums/${id}`, dto);
  }

  remove(id: number): Promise<object> {
    return this.upstream.delete<object>(`/albums/${id}`);
  }

  findPhotos(albumId: number): Promise<Photo[]> {
    return this.photosService.findAll({ albumId });
  }
}
