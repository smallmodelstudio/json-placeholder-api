import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ParsePositiveIntPipe } from '../../common/pipes/parse-positive-int.pipe';
import { Photo } from '../photos/entities/photo.entity';
import { AlbumsService } from './albums.service';
import { CreateAlbumDto } from './dto/create-album.dto';
import { QueryAlbumsDto } from './dto/query-albums.dto';
import { UpdateAlbumDto } from './dto/update-album.dto';
import { Album } from './entities/album.entity';

@Controller('albums')
export class AlbumsController {
  constructor(private readonly albumsService: AlbumsService) {}

  @Get()
  findAll(@Query() query: QueryAlbumsDto): Promise<Album[]> {
    return this.albumsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParsePositiveIntPipe) id: number): Promise<Album> {
    return this.albumsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateAlbumDto): Promise<Album> {
    return this.albumsService.create(dto);
  }

  @Put(':id')
  update(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dto: UpdateAlbumDto,
  ): Promise<Album> {
    return this.albumsService.update(id, dto);
  }

  @Patch(':id')
  patch(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dto: UpdateAlbumDto,
  ): Promise<Album> {
    return this.albumsService.patch(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParsePositiveIntPipe) id: number): Promise<object> {
    return this.albumsService.remove(id);
  }

  @Get(':id/photos')
  findPhotos(@Param('id', ParsePositiveIntPipe) id: number): Promise<Photo[]> {
    return this.albumsService.findPhotos(id);
  }
}
