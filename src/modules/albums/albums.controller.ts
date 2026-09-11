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
import { ApiTags } from '@nestjs/swagger';
import {
  ApiCommonErrorResponses,
  ApiEnvelopedEmptyResponse,
  ApiEnvelopedResponse,
} from '../../common/decorators/api-envelope-response.decorator';
import { ParsePositiveIntPipe } from '../../common/pipes/parse-positive-int.pipe';
import { Photo } from '../photos/entities/photo.entity';
import { AlbumsService } from './albums.service';
import { CreateAlbumDto } from './dto/create-album.dto';
import { QueryAlbumsDto } from './dto/query-albums.dto';
import { UpdateAlbumDto } from './dto/update-album.dto';
import { Album } from './entities/album.entity';

@ApiTags('albums')
@ApiCommonErrorResponses()
@Controller('albums')
export class AlbumsController {
  constructor(private readonly albumsService: AlbumsService) {}

  @Get()
  @ApiEnvelopedResponse(Album, { isArray: true })
  findAll(@Query() query: QueryAlbumsDto): Promise<Album[]> {
    return this.albumsService.findAll(query);
  }

  @Get(':id')
  @ApiEnvelopedResponse(Album)
  findOne(@Param('id', ParsePositiveIntPipe) id: number): Promise<Album> {
    return this.albumsService.findOne(id);
  }

  @Post()
  @ApiEnvelopedResponse(Album, { status: 201 })
  create(@Body() dto: CreateAlbumDto): Promise<Album> {
    return this.albumsService.create(dto);
  }

  // PUT is a full replace — see PostsController.update()'s comment for why
  // PATCH below uses a different (partial) DTO.
  @Put(':id')
  @ApiEnvelopedResponse(Album)
  update(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dto: CreateAlbumDto,
  ): Promise<Album> {
    return this.albumsService.update(id, dto);
  }

  @Patch(':id')
  @ApiEnvelopedResponse(Album)
  patch(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dto: UpdateAlbumDto,
  ): Promise<Album> {
    return this.albumsService.patch(id, dto);
  }

  @Delete(':id')
  @ApiEnvelopedEmptyResponse(
    'Album deleted (JSONPlaceholder does not persist deletes)',
  )
  remove(@Param('id', ParsePositiveIntPipe) id: number): Promise<object> {
    return this.albumsService.remove(id);
  }

  @Get(':id/photos')
  @ApiEnvelopedResponse(Photo, { isArray: true })
  findPhotos(@Param('id', ParsePositiveIntPipe) id: number): Promise<Photo[]> {
    return this.albumsService.findPhotos(id);
  }
}
